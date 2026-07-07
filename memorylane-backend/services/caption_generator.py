import os
import hashlib
import json
import logging
import asyncio
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

# Try importing anthropic
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

# Try importing google-genai
try:
    from google import genai
    from PIL import Image
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

# Cache file path
CACHE_FILE = "caption_cache.json"
_in_memory_cache: Dict[str, str] = {}

def load_cache():
    global _in_memory_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _in_memory_cache = json.load(f)
        except Exception as e:
            logger.error("Failed to load caption cache: %s", e)

def save_cache():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_in_memory_cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Failed to save caption cache: %s", e)

# Load cache at start
load_cache()

VISUAL_ANALYSIS_PROMPT = """
Analyse this photo and return a JSON object with these exact fields:

{
  "face_count": int,  // number of visible faces
  "estimated_ages": [str],  // rough age groups: "child", "young adult", "middle aged", "elderly"
  "dominant_emotion": str,  // the most prominent emotion across all faces: laughing, smiling, crying_happy, surprised, serious, concentrating, candid_unaware
  "secondary_emotion": str or null,  // second emotion if multiple people show different things
  "is_group_shot": bool,  // more than 3 people
  "is_intimate_shot": bool,  // 1-2 people, close framing
  "is_detail_shot": bool,  // no faces, focus on object/decoration/food/hands
  "scene_type": str,  // one of: ceremony, reception, portraits, candid, food_detail, venue_detail, dance, ritual, family_group, couple, children, elderly_relative
  "notable_detail": str,  // one specific visible detail: "bride adjusting veil", "grandmother wiping tear", "child stealing food", "couple looking at each other not camera", "confetti falling", "diyas being lit"
  "time_of_day": str,  // "day", "golden_hour", "evening", "night" based on lighting
  "composition": str  // "close_up", "medium", "wide", "detail"
}

Return ONLY the JSON. No explanation.
"""

CAPTION_STYLES = {
    "cinematic": "Cinematic and atmospheric. Short declarative sentences. Present tense. Like a film frame description. Spare and precise.",
    "warm": "Warm and personal. Like a loving family member narrating. May use 'you' occasionally. Affectionate but not saccharine.",
    "witty": "Observational humour. Dry wit. Notice the funny specific detail. Never mean-spirited. Like a sharp-eyed wedding guest writing captions.",
    "poetic": "Lyrical and imagistic. May use metaphor or implication. Favours suggestion over statement. Reads like a line of poetry.",
    "minimal": "Extreme brevity. 1-5 words maximum. A single precise observation. Fragment sentences are encouraged. Silence is part of the style."
}

CAPTION_GENERATION_PROMPT = """
You are writing captions for a premium photo gallery app used by Indian families.

EVENT: {event_name} ({event_type})
LANGUAGE: {language}
STYLE INSTRUCTION: {style_instruction}

THIS PHOTO:
- Scene: {scene_type}
- Faces visible: {face_count} people
- Emotion: {dominant_emotion}{secondary_emotion_text}
- Specific detail: {notable_detail}
- Shot type: {composition}
- Time: {time_of_day}
- Chapter/Moment: "{chapter_name}" ({position_in_chapter_text})

CONTEXT:
- Previous photo showed: {prev_scene_type} ({prev_emotion})
- Next photo shows: {next_scene_type}
{prev_caption_text}

RULES — follow every one of these:
1. Write exactly ONE sentence. Maximum 12 words.
2. The caption must be about THIS specific photo only. It must reference the notable detail or the specific emotion or the specific scene type. If you could apply the caption to any other photo, it is wrong.
3. Never use these words or phrases: "moment", "memory", "time", "forever", "joy", "laughter fills", "frozen", "captured", "beautiful", "magical", "special", "precious", "heart", "soul", "love fills". These are banned.
4. Use the second person "you" sparingly — prefer the third person or an implied subject.
5. Vary sentence structure from the surrounding photos.
6. For detail shots (no faces): describe what the object represents or suggests, not what it is literally.
7. For chapter openers: the caption can be slightly more atmospheric — set the scene.
8. For chapter closers: the caption can be slightly more reflective — it's a transition.
9. For the gallery opener (first photo): the caption should invite the viewer in.
10. For the gallery closer (last photo): the caption should feel like an ending.
11. If language is Hindi: write the caption in Hindi (Devanagari script). If "Both": write English caption then a Hindi translation on the next line in smaller text, separated by a <br /> line break.

EXAMPLES OF GOOD COMPLIANT CAPTIONS:
- "She closes her eyes for one breath before the doors open." [ceremony, bride, intimate]
- "Three generations, one table, zero leftovers." [reception, family group, candid, food nearby]
- "He's been trying to get her attention for this entire song." [dance, candid, two people]
- "The diyas hold still even when nothing else does." [ritual, detail shot, diyas]
- "Nobody told the flower girl there was a schedule." [ceremony, child, candid]
- "Finally." [couple portrait, gallery closer, minimal — one word says everything]
- "Your nani found the dance floor before you did." [reception, elderly woman, dancing, candid]
- "The one photo where everyone actually looked." [family group, wide shot]
- "Confetti falls. He doesn't notice. He's still looking at her." [reception, couple, detail]

EXAMPLES OF BAD CAPTIONS (do not write anything like these):
- "A beautiful moment captured forever." [banned words, generic]
- "Joy and laughter fill the air as the family celebrates." [banned words, describes nothing]
- "A memory that will last a lifetime." [banned words, could apply to any photo]
- "The magic of this special day." [banned words, meaningless]

Now write the caption for this specific photo. Return only the caption text. No quotes. No label. No explanation.
"""

async def analyze_photo_visually(image_path: str) -> dict:
    """
    First pass: calls Claude Vision or Gemini Vision to extract photo characteristics in JSON.
    """
    default_analysis = {
        "face_count": 0,
        "estimated_ages": [],
        "dominant_emotion": "candid_unaware",
        "secondary_emotion": None,
        "is_group_shot": False,
        "is_intimate_shot": False,
        "is_detail_shot": True,
        "scene_type": "candid",
        "notable_detail": "a candid scene at the event",
        "time_of_day": "day",
        "composition": "medium"
    }

    # Resolve relative S3 key to local disk path if needed
    local_path = image_path
    if not os.path.exists(local_path):
        local_s3_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_s3_bucket"))
        resolved = os.path.join(local_s3_dir, image_path)
        if os.path.exists(resolved):
            local_path = resolved

    if not os.path.exists(local_path):
        logger.warning("Visual analysis file not found: %s", image_path)
        return default_analysis

    # Check cache first
    try:
        file_size = os.path.getsize(local_path)
        cache_key = f"analysis:{os.path.basename(image_path)}:{file_size}"
    except Exception:
        cache_key = f"analysis:{image_path}"

    if cache_key in _in_memory_cache:
        try:
            return json.loads(_in_memory_cache[cache_key])
        except Exception:
            pass

    gemini_key = os.getenv("GEMINI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    analysis_res = None

    # 1. Try Gemini Vision
    if gemini_key and "mock" not in gemini_key and HAS_GEMINI:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                client = genai.Client(api_key=gemini_key)
                with Image.open(local_path) as pil_img:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model='gemini-2.0-flash',
                        contents=[pil_img, VISUAL_ANALYSIS_PROMPT]
                    )
                    text = response.text.strip()
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    analysis_res = json.loads(text)
                break  # Success, exit retry loop
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 10  # 10s, 20s backoff
                    logger.warning("Gemini 429 rate limit on visual analysis (attempt %d), waiting %ds...", attempt + 1, wait_time)
                    await asyncio.sleep(wait_time)
                else:
                    logger.error("Gemini Vision analysis failed: %s", e)
                    break

    # 2. Try Claude Vision
    if not analysis_res and anthropic_key and "mock" not in anthropic_key and HAS_ANTHROPIC:
        try:
            client = anthropic.AsyncAnthropic(api_key=anthropic_key)
            with open(local_path, "rb") as f:
                image_data = f.read()
                import base64
                base64_image = base64.b64encode(image_data).decode("utf-8")
            
            media_type = "image/jpeg"
            if image_path.lower().endswith(".png"):
                media_type = "image/png"

            message = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=250,
                temperature=0.0,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": base64_image,
                                },
                            },
                            {
                                "type": "text",
                                "text": VISUAL_ANALYSIS_PROMPT
                            }
                        ],
                    }
                ],
            )
            text = message.content[0].text.strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            analysis_res = json.loads(text)
        except Exception as e:
            logger.error("Claude Vision analysis failed: %s", e)

    # 3. Development Fallback Mock Details
    if not analysis_res:
        path_hash = int(hashlib.md5(image_path.encode()).hexdigest(), 16)
        scene_types = ["ceremony", "reception", "portraits", "candid", "food_detail", "dance", "ritual"]
        emotions = ["smiling", "laughing", "candid_unaware", "serious", "surprised"]
        details = [
            "couple looking at each other not camera",
            "family members embracing and smiling",
            "guests laughing around a table",
            "bride adjusting traditional bangles",
            "flames rising from the holy havan kunda",
            "dancing under golden canopy spotlights",
            "colourful dessert counters and flower decor"
        ]

        mock_analysis = default_analysis.copy()
        mock_analysis["scene_type"] = scene_types[path_hash % len(scene_types)]
        mock_analysis["dominant_emotion"] = emotions[path_hash % len(emotions)]
        mock_analysis["notable_detail"] = details[path_hash % len(details)]
        mock_analysis["is_detail_shot"] = "detail" in mock_analysis["scene_type"]
        mock_analysis["face_count"] = 0 if mock_analysis["is_detail_shot"] else (1 if path_hash % 3 == 0 else 3)
        analysis_res = mock_analysis

    # Save to cache
    try:
        _in_memory_cache[cache_key] = json.dumps(analysis_res)
        save_cache()
    except Exception as e:
        logger.error("Failed to save to cache: %s", e)

    return analysis_res

def build_photo_context(photo_index: int, all_photos: list, chapters: dict) -> dict:
    current = all_photos[photo_index]
    prev = all_photos[photo_index - 1] if photo_index > 0 else None
    next_photo = all_photos[photo_index + 1] if photo_index < len(all_photos) - 1 else None
    
    chap_idx = current.get("chapter_index", 0)
    chap_name = chapters.get(chap_idx, {}).get("name", "Story") if chapters else "Story"
    
    # Calculate chapter bounds
    chap_photos = [p for p in all_photos if p.get("chapter_index", 0) == chap_idx]
    position_in_chap = chap_photos.index(current) if current in chap_photos else 0
    
    return {
        "position_in_gallery": photo_index + 1,
        "total_photos": len(all_photos),
        "chapter_name": chap_name,
        "position_in_chapter": position_in_chap,
        "chapter_size": len(chap_photos),
        "is_chapter_opener": position_in_chap == 0,
        "is_chapter_closer": position_in_chap == len(chap_photos) - 1,
        "is_gallery_opener": photo_index == 0,
        "is_gallery_closer": photo_index == len(all_photos) - 1,
        "prev_scene_type": prev.get("visual_analysis", {}).get("scene_type") if prev else None,
        "next_scene_type": next_photo.get("visual_analysis", {}).get("scene_type") if next_photo else None,
        "prev_emotion": prev.get("visual_analysis", {}).get("dominant_emotion") if prev else None,
    }

async def generate_single_caption(
    image_path: str,
    context: dict,
    event_context: dict
) -> str:
    """
    Second pass: calls Gemini or Claude model using visual analysis metadata and sequential context.
    """
    analysis = context.get("visual_analysis", {})
    
    # Build prompt formatting variables
    sec_emotion = analysis.get("secondary_emotion")
    sec_emotion_text = f" (secondary: {sec_emotion})" if sec_emotion else ""
    
    pos_in_chap = context.get("position_in_chapter", 0)
    chap_size = context.get("chapter_size", 1)
    pos_in_chap_text = f"photo {pos_in_chap + 1} of {chap_size}"
    
    prev_caption = context.get("prev_caption")
    prev_caption_text = f"- Previous caption was: '{prev_caption}' — write this one with a different sentence structure." if prev_caption else ""
    
    style_key = event_context.get("caption_style", "cinematic").lower()
    style_instruction = CAPTION_STYLES.get(style_key, CAPTION_STYLES["cinematic"])

    # Resolve local path for file size hashing
    local_path = image_path
    if not os.path.exists(local_path):
        local_s3_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_s3_bucket"))
        resolved = os.path.join(local_s3_dir, image_path)
        if os.path.exists(resolved):
            local_path = resolved

    try:
        file_size = os.path.getsize(local_path)
        prev_cap_hash = hashlib.md5((prev_caption or "").encode()).hexdigest()[:6]
        detail_hash = hashlib.md5((analysis.get("notable_detail") or "").encode()).hexdigest()[:6]
        cache_key = f"caption:{os.path.basename(image_path)}:{file_size}:{style_key}:{event_context.get('language')}:{detail_hash}:{prev_cap_hash}"
    except Exception:
        cache_key = f"caption:{image_path}:{style_key}:{event_context.get('language')}"

    if cache_key in _in_memory_cache:
        return _in_memory_cache[cache_key]

    formatted_prompt = CAPTION_GENERATION_PROMPT.format(
        event_name=event_context.get("event_name", "My Event"),
        event_type=event_context.get("event_type", "Celebration"),
        language=event_context.get("language", "English"),
        style_instruction=style_instruction,
        scene_type=analysis.get("scene_type", "candid"),
        face_count=analysis.get("face_count", 0),
        dominant_emotion=analysis.get("dominant_emotion", "smiling"),
        secondary_emotion_text=sec_emotion_text,
        notable_detail=analysis.get("notable_detail", "candid moment"),
        composition=analysis.get("composition", "medium"),
        time_of_day=analysis.get("time_of_day", "day"),
        chapter_name=context.get("chapter_name", "Story"),
        position_in_chapter_text=pos_in_chap_text,
        prev_scene_type=context.get("prev_scene_type") or "None",
        prev_emotion=context.get("prev_emotion") or "None",
        next_scene_type=context.get("next_scene_type") or "None",
        prev_caption_text=prev_caption_text
    )

    gemini_key = os.getenv("GEMINI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    caption_res = None

    # 1. Try Gemini
    if gemini_key and "mock" not in gemini_key and HAS_GEMINI:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                from google.genai import types
                client = genai.Client(api_key=gemini_key)
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model='gemini-2.0-flash',
                    contents=[formatted_prompt],
                    config=types.GenerateContentConfig(
                        temperature=0.85,
                        system_instruction="You are an expert storyteller writing highly unique, non-repetitive captions for a premium photo gallery. Never repeat sentence structures or key themes from the previous caption."
                    )
                )
                caption = response.text.strip()
                if caption:
                    if caption.startswith('"') and caption.endswith('"'):
                        caption = caption[1:-1]
                    caption_res = caption
                break  # Success, exit retry loop
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 10
                    logger.warning("Gemini 429 rate limit on caption gen (attempt %d), waiting %ds...", attempt + 1, wait_time)
                    await asyncio.sleep(wait_time)
                else:
                    logger.error("Gemini text caption generation failed: %s", e)
                    break

    # 2. Try Claude
    if not caption_res and anthropic_key and "mock" not in anthropic_key and HAS_ANTHROPIC:
        try:
            client = anthropic.AsyncAnthropic(api_key=anthropic_key)
            message = await client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=100,
                temperature=0.7,
                messages=[{"role": "user", "content": formatted_prompt}]
            )
            caption = message.content[0].text.strip()
            if caption.startswith('"') and caption.endswith('"'):
                caption = caption[1:-1]
            caption_res = caption
        except Exception as e:
            logger.error("Claude text caption generation failed: %s", e)

    # 3. Development Fallback Mock Captions matching tone styles
    if not caption_res:
        path_hash = int(hashlib.md5(image_path.encode()).hexdigest(), 16)
        
        # Premium observatives matching tone rules without forbidden words
        presets = {
            "cinematic": [
                "Heavy doors slide open. She doesn't look up yet.",
                "Laughter spills over the edge of the dining tables.",
                "Confetti settles on his collar while she continues dancing.",
                "Nani leads the bridesmaids out onto the lit dancefloor.",
                "The evening lights turn the canopy backdrop into gold."
            ],
            "warm": [
                "We found nani claiming the center of the dancefloor early.",
                "Look at the way he watches her adjust her bangles.",
                "This table stayed talking long after the desserts cleared.",
                "You can tell she was trying hard not to tear up here.",
                "The kind of candid hug that makes everyone look away."
            ],
            "witty": [
                "Exactly five seconds before the flower girl stole the cake.",
                "They promised zero drama. The expressions say otherwise.",
                "He's explaining the schedule. Nobody appears to be listening.",
                "The photographer asked for serious looks. This is the result.",
                "Diyas are lit. The relatives are already ranking the snacks."
            ],
            "poetic": [
                "Flame meets wick as whispers float into the night.",
                "A single step forward, leaving footprints in gold dust.",
                "Silhouettes dance against the orange glow of the embers.",
                "The bangles chime softly in the stillness of the temple.",
                "Glances exchanged across a room full of noise."
            ],
            "minimal": [
                "A quiet glance.",
                "Finally.",
                "The dance begins.",
                "Stealing a bite.",
                "Together."
            ]
        }

        style_presets = presets.get(style_key, presets["cinematic"])
        base_caption = style_presets[path_hash % len(style_presets)]

        if event_context.get("language") == "Hindi":
            hindi_presets = {
                "cinematic": "द्वार खुलते ही सबकी आँखें उन्हीं पर टिक गईं।",
                "warm": "दादी ने सबसे पहले डांस फ्लोर संभाला।",
                "witty": "मिठाई चुराने की कोशिश में पकड़े गए बच्चे।",
                "poetic": "दीपशिखा की रोशनी में मुस्कुराता हुआ चेहरा।",
                "minimal": "एक नई शुरुआत।"
            }
            caption_res = hindi_presets.get(style_key, hindi_presets["cinematic"])
        elif event_context.get("language") == "Both":
            hindi_presets = {
                "cinematic": "द्वार खुलते ही सबकी आँखें उन्हीं पर टिक गईं।",
                "warm": "दादी ने सबसे पहले डांस फ्लोर संभाला।",
                "witty": "मिठाई चुराने की कोशिश में पकड़े गए बच्चे।",
                "poetic": "दीपशिखा की रोशनी में मुस्कुराता हुआ चेहरा।",
                "minimal": "एक नई शुरुआत।"
            }
            translated = hindi_presets.get(style_key, hindi_presets["cinematic"])
            caption_res = f"{base_caption}<br />{translated}"
        else:
            caption_res = base_caption

    # Save to cache
    try:
        _in_memory_cache[cache_key] = caption_res
        save_cache()
    except Exception as e:
        logger.error("Failed to save caption to cache: %s", e)
        
    return caption_res

async def generate_captions_sequential(photos: list, event_context: dict) -> list:
    """
    Sequential generation loop ensuring non-repetition.
    photos list item: {"path": str, "visual_analysis": dict, "chapter_index": int}
    """
    captions = []
    prev_caption = None
    
    for i, photo in enumerate(photos):
        context = build_photo_context(i, photos, event_context.get("chapters", {}))
        context["visual_analysis"] = photo.get("visual_analysis") or {}
        
        if prev_caption:
            context["prev_caption"] = prev_caption
            
        caption = await generate_single_caption(photo["path"], context, event_context)
        captions.append(caption)
        prev_caption = caption
        
        await asyncio.sleep(1.5)  # Respect Gemini rate limits
        
    return captions

async def generate_captions_batched(photos: list, event_context: dict) -> list:
    """
    Batched caption generation loop running batches of 5 in parallel to optimize pipeline speed.
    """
    BATCH_SIZE = 5
    all_captions = []
    
    for i in range(0, len(photos), BATCH_SIZE):
        batch = photos[i:i + BATCH_SIZE]
        
        # Pass previous caption for context (use last caption of previous batch)
        prev_caption = all_captions[-1] if all_captions else None
        
        # Generate batch in parallel
        tasks = []
        for j, photo in enumerate(batch):
            context = build_photo_context(i + j, photos, event_context.get("chapters", {}))
            context["visual_analysis"] = photo.get("visual_analysis") or {}
            if j == 0 and prev_caption:
                context["prev_caption"] = prev_caption
            tasks.append(generate_single_caption(photo["path"], context, event_context))
        
        batch_captions = await asyncio.gather(*tasks)
        all_captions.extend(batch_captions)
        
        # Small delay between batches to respect rate limits
        await asyncio.sleep(5)  # Increased delay between batches to respect Gemini rate limits
    
    return all_captions
