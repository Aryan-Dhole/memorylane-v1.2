import os
import sys
import uuid
import datetime

# Add parent directory to path to allow importing utils and services
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.supabase_client import supabase

def seed_demo():
    print("Starting database seed script for MemoryLane digital demo book...")
    
    # 1. Resolve user_id using auth admin client
    user_id = None
    try:
        users_res = supabase.auth.admin.list_users()
        # Handle both SDK returns (a raw list or an object with a .users attribute)
        user_list = []
        if isinstance(users_res, list):
            user_list = users_res
        elif hasattr(users_res, "users"):
            user_list = users_res.users
            
        if user_list:
            # Try to find our demo email first
            for u in user_list:
                if u.email == "customer@example.com":
                    user_id = u.id
                    break
            # Fall back to the first available user
            if not user_id:
                user_id = user_list[0].id
            print("Found existing auth user ID:", user_id)
    except Exception as e:
        print("Failed to query auth users:", e)
        
    if not user_id:
        try:
            new_user = supabase.auth.admin.create_user({
                "email": "customer@example.com",
                "password": "Password123!",
                "email_confirm": True
            })
            user_id = new_user.user.id
            print("Created a new auth user for demo seed:", user_id)
            
            # Try inserting matching profile if needed
            try:
                supabase.table("profiles").insert({
                    "id": user_id,
                    "full_name": "Demo Customer",
                    "email": "customer@example.com"
                }).execute()
            except Exception as pe:
                print("Profile insertion bypassed:", pe)
        except Exception as e:
            print("Failed to create a seed user:", e)
            return
        
    order_id = "de000000-0000-0000-0000-000000000000"
    batch_id = "de000000-0000-0000-0000-000000000001"
    
    # 2. Clean existing demo data to permit re-running the script
    try:
        # Cascade deletes will clean up related photos/batches automatically
        supabase.table("orders").delete().eq("share_token", "demo").execute()
        print("Cleaned up existing demo orders.")
    except Exception as e:
        print("Clean deletion failed (or didn't exist yet):", e)
        
    # 3. Create demo order
    order_data = {
        "id": order_id,
        "user_id": user_id,
        "status": "ready",
        "book_type": "wedding",
        "tier": "classic",
        "page_count": 20,
        "total_price": 59900,
        "book_title": "Rahul & Priya's Wedding Celebration",
        "share_token": "demo",
        "pdf_s3_key": "books/demo/photo_book.pdf",
        "share_url": "http://localhost:3000/book/demo",
        "pdf_download_url": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
        "ready_at": datetime.datetime.now().isoformat()
    }
    
    try:
        supabase.table("orders").insert(order_data).execute()
        print("Demo order record created.")
    except Exception as e:
        print("Error inserting demo order:", e)
        return
        
    # 4. Create demo photo batch
    batch_data = {
        "id": batch_id,
        "order_id": order_id,
        "s3_prefix": "uploads/demo/",
        "total_uploaded": 5,
        "total_processed": 5,
        "ai_status": "completed",
        "ai_progress": 100,
        "pipeline_result": {
            "chapters": [
                {"title": "The Preparation", "start_index": 0},
                {"title": "The Rituals", "start_index": 2},
                {"title": "The Reception", "start_index": 4}
            ]
        }
    }
    
    try:
        supabase.table("photo_batches").insert(batch_data).execute()
        print("Demo photo batch record created.")
    except Exception as e:
        print("Error inserting demo batch:", e)
        return
        
    # 5. Insert demo photo sequences
    photos = [
        {
            "batch_id": batch_id,
            "s3_key": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
            "original_filename": "prep_venue.jpg",
            "quality_score": 0.95,
            "sequence_index": 0,
            "is_selected": True,
            "caption": "The beautiful mandap setup awaiting the couple and guests.",
            "scene_label": "detail",
            "chapter_index": 0
        },
        {
            "batch_id": batch_id,
            "s3_key": "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80",
            "original_filename": "prep_couple.jpg",
            "quality_score": 0.96,
            "sequence_index": 1,
            "is_selected": True,
            "caption": "A tender moment as they capture the nervous excitement before the ceremony.",
            "scene_label": "portrait",
            "chapter_index": 0
        },
        {
            "batch_id": batch_id,
            "s3_key": "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
            "original_filename": "ritual_garlands.jpg",
            "quality_score": 0.94,
            "sequence_index": 2,
            "is_selected": True,
            "caption": "The vibrant varmala garland exchange sealing their promise.",
            "scene_label": "ritual",
            "chapter_index": 1
        },
        {
            "batch_id": batch_id,
            "s3_key": "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
            "original_filename": "ritual_fire.jpg",
            "quality_score": 0.97,
            "sequence_index": 3,
            "is_selected": True,
            "caption": "Walking hand-in-hand around the sacred agni fire.",
            "scene_label": "ritual",
            "chapter_index": 1
        },
        {
            "batch_id": batch_id,
            "s3_key": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
            "original_filename": "reception_dance.jpg",
            "quality_score": 0.98,
            "sequence_index": 4,
            "is_selected": True,
            "caption": "Pure, uninhibited joy under the celebration lights.",
            "scene_label": "candid",
            "chapter_index": 2
        }
    ]
    
    for i, p in enumerate(photos):
        try:
            supabase.table("photos").insert(p).execute()
        except Exception as e:
            print(f"Error inserting photo {i}:", e)
            
    print("Demo photo book successfully seeded! Access token = 'demo'")

if __name__ == "__main__":
    seed_demo()
