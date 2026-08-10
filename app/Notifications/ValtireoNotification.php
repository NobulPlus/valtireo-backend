<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ValtireoNotification extends Notification
{
    use Queueable;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(private readonly array $data)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if (config('services.valtireo_notifications.mail_enabled')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return $this->data;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject($this->data['title'] ?? 'Valtireo notification')
            ->greeting("Hello {$notifiable->name},")
            ->line($this->data['message'] ?? 'You have a new Valtireo notification.');

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        return $message->line('Thank you for using Valtireo.');
    }

    private function absoluteUrl(string $url): string
    {
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return rtrim(config('services.valtireo_notifications.frontend_url'), '/').'/'.ltrim($url, '/');
    }
}
