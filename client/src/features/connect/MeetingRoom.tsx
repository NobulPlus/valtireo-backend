import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export default function MeetingRoom({ credentials, onLeave, onError }: {
  credentials: { token: string; server_url: string };
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  return <div data-lk-theme="default" className="overflow-hidden rounded-xl" style={{ height: 'min(75vh, 800px)', minHeight: 420 }}>
    <LiveKitRoom token={credentials.token} serverUrl={credentials.server_url} connect audio={false} video={false}
      onDisconnected={onLeave} onError={(error) => onError(error.message)}>
      <VideoConference />
    </LiveKitRoom>
  </div>;
}
