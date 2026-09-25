import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-display text-4xl font-semibold text-pine">404</p>
      <p className="text-sm text-muted">This page doesn't exist or has moved.</p>
      <Link to="/">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
