import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-strong"
      title="Install OrgaviaHR as an app"
      aria-label="Install OrgaviaHR as an app"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
