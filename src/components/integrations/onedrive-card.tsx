import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive } from "lucide-react";

export function OneDriveCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-4" /> OneDrive / SharePoint
        </CardTitle>
        <CardDescription>
          Direkter Zugriff auf strukturierte Excel-Tabellen in OneDrive oder SharePoint über Microsoft Graph.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline">In Vorbereitung</Badge>
        <p className="text-sm text-muted-foreground">
          Datenmodell, API-Struktur und Berechtigungskonzept sind vorbereitet (siehe Dokumentation). Die
          Dateiauswahl und der Lese-/Schreibzugriff auf definierte Tabellenbereiche werden aktiviert, sobald eine
          Microsoft-Verbindung besteht. Schreibzugriffe erfolgen ausschließlich nach expliziter Freigabe durch die
          Geschäftsführung.
        </p>
      </CardContent>
    </Card>
  );
}
