"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ROLE_LABEL: Record<string, string> = {
  GESCHAEFTSFUEHRER: "Geschäftsführer",
  ADMINISTRATOR: "Administrator",
  MITARBEITER: "Mitarbeiter",
};

export function ProfileForm({ name, email, role }: { name: string; email: string; role: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      toast.success("Profil aktualisiert");
      router.refresh();
    } catch {
      toast.error("Profil konnte nicht aktualisiert werden");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Ihre persönlichen Kontodaten.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Label>E-Mail</Label>
              <Input value={email} disabled className="mt-2" />
            </div>
            <div>
              <Label>Rolle</Label>
              <Input value={ROLE_LABEL[role] ?? role} disabled className="mt-2" />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Speichern
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
