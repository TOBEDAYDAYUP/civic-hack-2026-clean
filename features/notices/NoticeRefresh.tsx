'use client';
import { useRouter } from 'next/navigation';
import { useNoticeUpdates } from './useNoticeUpdates';
export default function NoticeRefresh() {
  const router = useRouter();
  useNoticeUpdates(() => router.refresh());
  return null;
}
