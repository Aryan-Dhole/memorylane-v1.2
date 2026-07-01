import unittest
import os
import sys

# Append parent dir to python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from services.quality_scorer import score_image_quality
from services.face_detector import detect_faces, cluster_faces_in_batch
from services.duplicate_remover import remove_duplicates, cluster_by_time
from services.aesthetic_scorer import score_aesthetic
from routes.payments import verify_razorpay_signature

class TestMemoryLanePipeline(unittest.TestCase):

    def test_quality_scorer_rejections(self):
        """Verify quality scorer rejects blurry or low-res images."""
        res_blurry = score_image_quality("uploads/user_default/batch1/blurry_pic.jpg")
        self.assertTrue(res_blurry["reject"], "Blurry images should be rejected")
        self.assertLess(res_blurry["blur_score"], 30.0)

        res_lowres = score_image_quality("uploads/user_default/batch1/low_res_pic.jpg")
        self.assertTrue(res_lowres["reject"], "Low-res images should be rejected")
        self.assertFalse(res_lowres["resolution_ok_standard"])

        res_good = score_image_quality("uploads/user_default/batch1/sharp_pic.jpg")
        # Default mock sharp should pass
        self.assertFalse(res_good["reject"], "Sharp standard res images should be approved")

    def test_face_detector_counts_and_scores(self):
        """Verify face detector mock scoring logic."""
        res_faces = detect_faces("uploads/user_default/batch1/happy_family.jpg")
        # Should have faces and happy emotion
        self.assertGreater(res_faces["face_count"], 0)
        self.assertGreater(res_faces["face_score"], 50.0)

        res_no_faces = detect_faces("uploads/user_default/batch1/no_faces_landscape.jpg")
        self.assertEqual(res_no_faces["face_count"], 0)
        self.assertEqual(res_no_faces["face_score"], 0.0)

    def test_duplicate_remover_burst(self):
        """Verify that burst shots trigger duplicate removal."""
        q_scores = {
            "burst_A_1.jpg": {"final_quality_score": 80.0},
            "burst_A_2.jpg": {"final_quality_score": 92.0},  # should survive
            "burst_A_3.jpg": {"final_quality_score": 65.0},
            "portrait.jpg": {"final_quality_score": 85.0}    # should survive
        }
        
        paths = list(q_scores.keys())
        survivors = remove_duplicates(paths, q_scores)
        
        self.assertIn("burst_A_2.jpg", survivors)
        self.assertNotIn("burst_A_1.jpg", survivors)
        self.assertNotIn("burst_A_3.jpg", survivors)
        self.assertIn("portrait.jpg", survivors)

    def test_payment_signature_verification(self):
        """Verify Razorpay signature verification."""
        # Set mock key secret
        os.environ["RAZORPAY_KEY_SECRET"] = "mock_secret"
        
        # Test mock bypass for local dev
        is_valid_mock = verify_razorpay_signature("order_123", "pay_456", "mock_signature")
        self.assertTrue(is_valid_mock, "Mock signature should be accepted under mock settings")

        # Test invalid signature reject
        is_invalid = verify_razorpay_signature("order_123", "pay_456", "tampered_signature")
        self.assertFalse(is_invalid, "Tampered signature should be rejected")

    def test_supabase_jwt_auth_extraction(self):
        """Verify user ID extraction from Authorization headers."""
        from utils.supabase_client import get_user_id_from_auth
        
        # Test missing / malformed header
        uid_none = get_user_id_from_auth(None)
        self.assertEqual(uid_none, "00000000-0000-0000-0000-000000000000")
        
        uid_malformed = get_user_id_from_auth("InvalidTokenHere")
        self.assertEqual(uid_malformed, "00000000-0000-0000-0000-000000000000")
        
        # Test mock credentials bypass
        uid_mock = get_user_id_from_auth("Bearer mock_jwt_token")
        self.assertEqual(uid_mock, "00000000-0000-0000-0000-000000000000")

    def test_gemini_captioning_fallback(self):
        """Verify Gemini fallback behavior in caption generator."""
        from services.caption_generator import generate_single_caption
        import asyncio
        
        # Test mock fallback when no key is configured
        os.environ["GEMINI_API_KEY"] = "mock_gemini_key"
        os.environ["ANTHROPIC_API_KEY"] = "mock_anthropic_key"
        
        async def run():
            context = {"visual_analysis": {}, "position_in_chapter": 0, "chapter_size": 1}
            event_context = {"event_name": "Test Event", "event_type": "wedding", "caption_style": "poetic", "language": "English"}
            caption = await generate_single_caption("test_img.jpg", context, event_context)
            self.assertTrue(len(caption) > 0, "Fallback mock caption should be generated")
            
        asyncio.run(run())

    def test_trial_curation_worker(self):
        """Verify that process_job handles trial jobs when order_id is None."""
        from worker import process_job
        from unittest.mock import patch, MagicMock, AsyncMock
        import asyncio
        
        # Mock supabase client query response for photos
        mock_photos_res = MagicMock()
        mock_photos_res.data = [{"s3_key": "uploads/trial/mock_trial_id/photo_0.jpg"}]
        
        # We patch the supabase client table calls
        with patch("worker.supabase") as mock_supabase, \
             patch("worker.run_full_pipeline", new_callable=AsyncMock) as mock_pipeline:
             
            # Setup supabase mocks
            mock_table = MagicMock()
            mock_select = MagicMock()
            mock_eq = MagicMock()
            
            mock_supabase.table.return_value = mock_table
            mock_table.select.return_value = mock_select
            mock_table.update.return_value = mock_table
            mock_select.eq.return_value = mock_eq
            mock_eq.execute.return_value = mock_photos_res
            mock_table.eq.return_value = mock_table
            mock_table.execute.return_value = MagicMock(data=[])
            
            # Setup pipeline mock
            mock_pipeline.return_value = {
                "selected_photos": [{"path": "uploads/trial/mock_trial_id/photo_0.jpg", "caption": "Mock caption", "chapter": 0}],
                "face_clusters": [],
                "chapters": [],
                "processing_time_seconds": 1.5
            }
            
            # Create a mock job
            class MockJob:
                def __init__(self, data):
                    self.data = data
            
            job = MockJob({
                "batch_id": "mock_trial_id",
                "tier": "trial",
                "book_title": "Trial Preview",
                "caption_style": "poetic",
                "language": "English"
            })
            
            # Run process_job
            asyncio.run(process_job(job))
            
            # Assertions
            mock_pipeline.assert_called_once()
            # Confirm supabase was updated for trial_sessions and photo_batches
            mock_supabase.table.assert_any_call("trial_sessions")
            mock_supabase.table.assert_any_call("photo_batches")

if __name__ == "__main__":
    unittest.main()
