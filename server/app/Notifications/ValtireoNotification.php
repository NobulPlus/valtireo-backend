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
        $message = (new MailMessage)->subject($this->data['title'] ?? 'Valtireo notification');

        return match ($this->data['event'] ?? null) {
            'organization.admin_invited' => $this->organizationAdminInvitedMail($message, $notifiable),
            'employee.invited' => $this->employeeInvitedMail($message, $notifiable),
            default => $this->genericMail($message, $notifiable),
        };
    }

    private function organizationAdminInvitedMail(MailMessage $message, object $notifiable): MailMessage
    {
        $organizationCode = $this->data['metadata']['organization_code'] ?? null;
        $temporaryPassword = $this->data['metadata']['temporary_password'] ?? null;

        $message
            ->greeting("Welcome, {$notifiable->name}!")
            ->line($this->data['message'] ?? 'You have been invited to Valtireo.')
            ->line('Here are your sign-in details:')
            ->line("Email: **{$notifiable->email}**");

        if ($temporaryPassword) {
            $message->line("Temporary password: `{$temporaryPassword}`");
        }

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        $message->line("Once you sign in, you'll be guided through completing your organization's workspace setup — branding, locations, departments, and your team.");

        if ($organizationCode) {
            $message->line("Your organization code is **{$organizationCode}**.");
        }

        return $message->salutation("Welcome aboard,\nThe Valtireo Team");
    }

    private function employeeInvitedMail(MailMessage $message, object $notifiable): MailMessage
    {
        $expiresAt = $this->data['metadata']['expires_at'] ?? null;

        $message
            ->greeting("Hi {$notifiable->name},")
            ->line($this->data['message'] ?? 'You have been invited to join Valtireo.')
            ->line('This is a one-time invitation link — use it to set your password and get started.');

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        if ($expiresAt) {
            $formatted = \Illuminate\Support\Carbon::parse($expiresAt)->format('F j, Y \a\t g:i A');
            $message->line("This link expires on **{$formatted}**. If it expires, ask your HR team to resend the invitation.");
        }

        return $message->salutation("See you soon,\nThe Valtireo Team");
    }

    private function genericMail(MailMessage $message, object $notifiable): MailMessage
    {
        $message
            ->greeting("Hello {$notifiable->name},")
            ->line($this->data['message'] ?? 'You have a new Valtireo notification.');

        if (! empty($this->data['action_url']) && ! empty($this->data['action_label'])) {
            $message->action($this->data['action_label'], $this->absoluteUrl($this->data['action_url']));
        }

        if (! empty($this->data['metadata']['temporary_password'])) {
            $message->line('Temporary password: `'.$this->data['metadata']['temporary_password'].'`');
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
