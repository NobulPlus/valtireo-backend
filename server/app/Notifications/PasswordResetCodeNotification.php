<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

class PasswordResetCodeNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $code, private readonly int $expiresInMinutes) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Valtireo password reset code')
            ->greeting("Hi {$notifiable->name},")
            ->line('Use this code to reset your Valtireo password:')
            ->line(new HtmlString("<div style=\"font-size:28px;font-weight:700;letter-spacing:4px;text-align:center;margin:16px 0;\">{$this->code}</div>"))
            ->line("This code expires in {$this->expiresInMinutes} minutes.")
            ->line('If you did not request a password reset, you can safely ignore this email.');
    }
}
