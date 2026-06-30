-- Add check constraint for the updated order tiers (Starter, Classic, Premium, Heirloom)
ALTER TABLE public.orders 
ADD CONSTRAINT chk_order_tier 
CHECK (tier IN ('starter', 'classic', 'premium', 'heirloom'));
