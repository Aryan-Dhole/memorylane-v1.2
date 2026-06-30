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
        from services.caption_generator import generate_caption
        import asyncio
        
        # Test mock fallback when no key is configured
        os.environ["GEMINI_API_KEY"] = "mock_gemini_key"
        os.environ["ANTHROPIC_API_KEY"] = "mock_anthropic_key"
        
        async def run():
            caption = await generate_caption("test_img.jpg", "wedding", "poetic", "English")
            self.assertTrue(len(caption) > 0, "Fallback mock caption should be generated")
            
        asyncio.run(run())

if __name__ == "__main__":
    unittest.main()
