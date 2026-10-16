import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
});

export const updatePreferencesSchema = z.object({
  notifyByEmail: z.boolean(),
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

export const roleEnum = z.enum(["GESCHAEFTSFUEHRER", "ADMINISTRATOR", "MITARBEITER"]);

export const updateUserRoleSchema = z
  .object({
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: "Keine Änderung angegeben",
  });

export const createUserSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse").max(200),
  role: roleEnum.default("MITARBEITER"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein").max(200),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
