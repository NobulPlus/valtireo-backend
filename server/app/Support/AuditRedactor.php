<?php

namespace App\Support;

final class AuditRedactor
{
    public static function values(array $values): array
    {
        foreach ($values as $key => $value) {
            $normalized = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $key));
            if (preg_match('/password|token|secret|authorization|cookie|accountnumber|taxid|rsapin|nhfnumber/', $normalized)) {
                $values[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $values[$key] = self::values($value);
            }
        }

        return $values;
    }
}
