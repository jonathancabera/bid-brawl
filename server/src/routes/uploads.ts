import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const PRESIGN_EXPIRY_SECONDS = 60;

const router = Router();

router.post('/presign', requireAuth, async (req, res) => {
  const { content_type } = req.body as { content_type?: string };

  if (!content_type || !(content_type in ALLOWED_CONTENT_TYPES)) {
    return res
      .status(400)
      .json({ error: 'content_type must be one of image/jpeg, image/png' });
  }

  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const cloudfront_domain = process.env.CLOUDFRONT_DOMAIN;
  if (!bucket || !region || !cloudfront_domain) {
    console.error(
      'presign error: S3_BUCKET/AWS_REGION/CLOUDFRONT_DOMAIN not configured'
    );
    return res.status(500).json({ error: 'server misconfiguration' });
  }

  const { user_id } = (req as AuthRequest).user;
  const extension = ALLOWED_CONTENT_TYPES[content_type];
  const key = `uploads/${user_id}/${randomUUID()}.${extension}`;

  try {
    const s3 = new S3Client({ region });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: content_type,
    });

    const upload_url = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
    const public_url = `https://${cloudfront_domain}/${key}`;

    return res.status(200).json({ upload_url, key, public_url });
  } catch (err) {
    console.error('presign error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
