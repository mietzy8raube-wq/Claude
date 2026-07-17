import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { GRAPH_SCOPES } from "@/lib/graph/config";

export function PermissionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" /> Angeforderte Berechtigungen
        </CardTitle>
        <CardDescription>Minimal notwendige Microsoft-Graph-Berechtigungen (Least Privilege).</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {GRAPH_SCOPES.map((scope) => (
            <li key={scope} className="rounded-md bg-muted/50 px-2 py-1 font-mono text-xs">
              {scope}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
