# STARTKLAR. — Onboarding-Kompass · druckluft-technik Chemnitz
# Eine einzelne, vollständig eigenständige HTML-Datei (keine Datenbank,
# kein Backend, keine externen Ressourcen) — wird hier nur mit gzip/br-
# Kompression über nginx ausgeliefert.

FROM nginx:1.27-alpine

# Kompression für die Auslieferung aktivieren (die Datei selbst bleibt
# unverändert/lesbar; die Kompression passiert nur bei der Übertragung).
RUN printf 'gzip on;\ngzip_types text/html;\ngzip_min_length 1024;\ngzip_comp_level 6;\n' \
    > /etc/nginx/conf.d/gzip.conf

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
