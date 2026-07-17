import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    newPassword: z.string().min(8, "Neues Passwort muss mindestens 8 Zeichen lang sein"),
    confirmPassword: z.string().min(1, "Bitte Passwort bestätigen"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export const updateUserRoleSchema = z.object({
  role: z.enum(["GESCHAEFTSFUEHRER", "ADMINISTRATOR", "MITARBEITER"]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
