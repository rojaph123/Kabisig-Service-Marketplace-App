# Firebase Password Reset Email Template

Use this in Firebase Console:

1. Open Firebase Console
2. Open your `Kabisig` project
3. Go to `Authentication`
4. Open the `Templates` tab
5. Select `Password reset`
6. Edit the subject and message using the template below

## Suggested Subject

```text
Reset your Kabisig password
```

## Suggested Email Body

```text
Hello,

We received a request to reset your Kabisig password.

To continue, click the secure password reset link below:

%LINK%

If you did not request this, you can safely ignore this email.

Thank you,
Kabisig Support
Developed by Rov
```

## Notes

- `%LINK%` must stay exactly as written so Firebase can insert the real reset link.
- You can also customize the sender name in Firebase Authentication settings.
