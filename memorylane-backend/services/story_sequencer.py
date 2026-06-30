import os
import json
import hashlib
import datetime
from typing import List, Dict

try:
    import open_clip
    import torch
    HAS_CLIP = True
except ImportError:
    HAS_CLIP = False

SCENE_LABELS = [
    "establishing shots",
    "preparation",
    "portraits",
    "the ceremony",
    "celebration",
    "details and food",
    "candid moments",
    "formal group photos"
]

MOMENT_NAME_PROMPT = """
I have {total_photos} photos from a {event_type} called "{event_name}".
The AI has grouped them into {cluster_count} visual clusters.
Here are the dominant scene types in each cluster: {cluster_descriptions}

Generate {cluster_count} short, evocative moment names for these clusters.
Names should feel like chapter titles in a premium photo book.
Maximum 3 words each. Sentence case. No generic names like "More Photos" or "Part 2".
Return as a JSON array of strings. Nothing else.
"""

def classify_scene_mock(image_path: str) -> str:
    """Classifies the photo scene label deterministically based on its name and hash."""
    for label in SCENE_LABELS:
        if label.replace(" ", "_") in image_path.lower() or label in image_path.lower():
            return label
    path_hash = int(hashlib.md5(image_path.encode()).hexdigest(), 16)
    return SCENE_LABELS[path_hash % len(SCENE_LABELS)]

def sequence_photos(image_paths: list, scene_labels: dict, timestamps: dict) -> list:
    """Arranges a set of photos into a chronological and narrative arc."""
    if not image_paths:
        return []
    def get_time(path):
        time_str = timestamps.get(path)
        if time_str:
            try:
                return datetime.datetime.fromisoformat(time_str)
            except Exception:
                pass
        return datetime.datetime.min
    sorted_by_time = sorted(image_paths, key=get_time)
    return sorted_by_time

def detect_chapters(sequence: list, timestamps: dict, scene_labels: dict) -> list:
    """Detects chapter boundaries in a sequenced list of photos."""
    if not sequence:
        return []
    chapters = []
    current_chapter_title = "The Beginning"
    chapters.append({"title": current_chapter_title, "start_index": 0})
    
    def get_time(path):
        time_str = timestamps.get(path)
        if time_str:
            try:
                return datetime.datetime.fromisoformat(time_str)
            except Exception:
                pass
        return datetime.datetime.min

    for i in range(1, len(sequence)):
        prev_path = sequence[i-1]
        curr_path = sequence[i]
        t_prev = get_time(prev_path)
        t_curr = get_time(curr_path)
        time_gap_minutes = (t_curr - t_prev).total_seconds() / 60.0
        label_prev = scene_labels.get(prev_path, "")
        label_curr = scene_labels.get(curr_path, "")
        
        if time_gap_minutes > 20.0 or (label_prev != label_curr and time_gap_minutes > 5.0):
            title = label_curr.title()
            if title == "Establishing Shots":
                title = "The Prelude"
            elif title == "Details And Food":
                title = "Details & Decor"
            elif title == "The Ceremony":
                title = "The Vows"
            elif title == "Celebration":
                title = "The Festivities"
            if title == chapters[-1]["title"]:
                title = f"{title} Continued"
            chapters.append({"title": title, "start_index": i})
    return chapters

async def detect_moments(
    sequence: list,
    timestamps: dict,
    scene_labels: dict,
    event_name: str,
    event_type: str
) -> list:
    """
    Detects moment groups (renamed from chapters) in a sequenced list of photos.
    Returns:
        list of dict: [{"title": str, "start_index": int}]
    """
    if not sequence:
        return []
        
    event_type_lower = event_type.lower()
    
    # If wedding, use custom structured moments
    if "wedding" in event_type_lower:
        moments = []
        wedding_moment_mapping = {
            "preparation": "Getting Ready",
            "establishing shots": "Getting Ready",
            "the ceremony": "The Ceremony",
            "portraits": "Just Married",
            "formal group photos": "Family & Friends",
            "celebration": "The Celebration",
            "candid moments": "Candid Magic",
            "details and food": "The Details"
        }
        
        seen_moments = set()
        for idx, path in enumerate(sequence):
            lbl = scene_labels.get(path, "candid moments")
            m_title = wedding_moment_mapping.get(lbl, "Candid Magic")
            if m_title not in seen_moments:
                seen_moments.add(m_title)
                moments.append({"title": m_title, "start_index": idx})
        
        moments = sorted(moments, key=lambda x: x["start_index"])
        return moments
        
    # For non-weddings, use LLM to group and label, or fallback
    moments = []
    chapters = detect_chapters(sequence, timestamps, scene_labels)
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if len(chapters) > 1 and (gemini_key or anthropic_key):
        try:
            cluster_descriptions = []
            for i, ch in enumerate(chapters):
                start = ch["start_index"]
                end = chapters[i+1]["start_index"] if i < len(chapters) - 1 else len(sequence)
                sub_seq = sequence[start:end]
                sub_labels = [scene_labels.get(p, "candid") for p in sub_seq[:3]]
                cluster_descriptions.append(f"Cluster {i+1} starts at index {start} with dominant scenes: {', '.join(sub_labels)}")
                
            prompt = MOMENT_NAME_PROMPT.format(
                total_photos=len(sequence),
                event_type=event_type,
                event_name=event_name,
                cluster_count=len(chapters),
                cluster_descriptions="; ".join(cluster_descriptions)
            )
            
            titles = []
            if gemini_key and "mock" not in gemini_key:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[prompt]
                )
                text = response.text.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                titles = json.loads(text)
            elif anthropic_key and "mock" not in anthropic_key:
                import anthropic
                client = anthropic.Anthropic(api_key=anthropic_key)
                message = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=200,
                    temperature=0.0,
                    messages=[{"role": "user", "content": prompt}]
                )
                text = message.content[0].text.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                titles = json.loads(text)
                
            if len(titles) == len(chapters):
                for i, title in enumerate(titles):
                    moments.append({"title": title, "start_index": chapters[i]["start_index"]})
                return moments
        except Exception as e:
            import logging
            logging.getLogger("story_sequencer").error("Failed to generate custom moment titles via AI: %s", e)
            
    for ch in chapters:
        title = ch["title"]
        if title == "The Beginning":
            title = "Highlights"
        moments.append({"title": title, "start_index": ch["start_index"]})
        
    return moments
