import { request } from './client';

export interface PresignResponse {
  upload_url: string;
  key: string;
  public_url: string;
}

export function getPresignedUploadUrl(contentType: string): Promise<PresignResponse> {
  return request<PresignResponse>('/api/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ content_type: contentType }),
  });
}

export async function uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error('upload failed');
  }
}
