-- Allow anyone to view approved stations (even unauthenticated if needed, 
-- but 'true' covers authenticated users too)
DROP POLICY IF EXISTS "Public can view approved stations" ON public.station_requests;
CREATE POLICY "Public can view approved stations" ON public.station_requests 
FOR SELECT USING (status = 'approved');

-- Ensure admins can still do everything (this should already exist but being safe)
DROP POLICY IF EXISTS "Admins can manage all stations" ON public.station_requests;
CREATE POLICY "Admins can manage all stations" ON public.station_requests 
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
