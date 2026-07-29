-- Nieuwe medewerkerfoto's worden server-side naar WebP, maximaal 512x512 en <= 750 KB omgezet.
-- De bucketlimiet blijft iets ruimer voor bestaande bestanden en voorkomt grote nieuwe uploads.
update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'employee-avatars';
