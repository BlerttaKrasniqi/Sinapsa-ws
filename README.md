# Sinapsa – karta mësimore dhe materiale për studentë

Faqe në stilin e Quizlet për studentët e të gjitha fakulteteve. Kushdo mund të krijojë sete me karta
(pa regjistrim – mjafton të shkruajë emrin), të ngarkojë materiale (PDF, Word, PowerPoint, Excel, foto)
dhe të mësojë me karta që kthehen.

## Çfarë ka në këtë dosje

- `server.js` – serveri i vogël që ruan setet, materialet dhe skedarët (nuk kërkon instalime shtesë)
- `public/index.html` – e gjithë faqja
- `public/logo.png`, `public/favicon.png` – logoja e Sinapsës
- `public/vendor/` – mjetet që hapin skedarët Word dhe Excel brenda faqes
- `data/db.json` – krijohet vetë; këtu ruhen të gjitha setet dhe materialet
- `uploads/` – krijohet vetë; këtu ruhen të gjithë skedarët e ngarkuar

## Si ta hapni në kompjuterin tuaj

1. Instaloni Node.js (versioni 18 ose më i ri) nga https://nodejs.org – zgjidhni butonin "LTS".
2. Hapni (unzip) këtë dosje.
3. Hapni terminalin në dosje (Windows: hapni dosjen, klikoni shiritin e adresës, shkruani `cmd`, shtypni Enter).
4. Shkruani:

       node server.js

5. Hapni **http://localhost:3000** në shfletues.

Për ta ndalur, shtypni `Ctrl + C` në terminal.

## Që ta përdorin edhe kolegët

- **Në të njëjtin Wi-Fi:** kur serveri punon, kolegët hapin `http://IP-JA-E-KOMPJUTERIT:3000`
  (IP-në e gjeni me `ipconfig` në Windows ose `ifconfig` në Mac).
- **Në internet (rekomandohet):** ngarkojeni këtë dosje te çdo shërbim hostimi që mbështet Node.js
  (p.sh. Render, Railway ose një VPS i vogël), me komandën e nisjes `node server.js`.
  Serveri e lexon vetë cilësimin `PORT`. Zgjidhni hostim me disk të përhershëm, që dosjet
  `data/` dhe `uploads/` të mos humbin pas rinisjes.

## Kopjet rezervë

Kopjoni herë pas here dosjet `data` dhe `uploads` diku të sigurt. Aty është e gjithë përmbajtja.

## Mirë të dihet

- **Materialet:** PDF, DOC/DOCX, ODT, RTF, PPT/PPTX, ODP, XLS/XLSX, ODS, CSV, TXT, JPG/PNG/GIF/WEBP, ZIP/RAR/7Z – deri në 50 MB.
  Brenda faqes hapen PDF, Word (.docx), Excel, foto dhe tekst. Të tjerat (PowerPoint, .doc i vjetër, ZIP) shkarkohen.
- **Kartat:** te setet mund të bashkëngjitni PDF dhe foto, si dhe një foto për çdo kartë.
- Nuk ka llogari, prandaj kushdo me lidhjen mund të ndryshojë ose fshijë çdo set apo material.
  "Të miat" tregon çfarë keni krijuar në këtë pajisje ose me emrin tuaj.
- Herën e parë shtohen dy sete shembull. Mund t'i fshini nga faqja kur të doni.
- Lista e fakulteteve është në krye të `public/index.html` dhe `server.js` (`FACULTIES`).
  Nëse shtoni ose ndryshoni një fakultet, bëjeni në të dy skedarët.
- Nëse keni pasur versionin e mëparshëm (MedDeck), kopjoni dosjet e tij `data` dhe `uploads` këtu –
  setet e vjetra kalojnë automatikisht te fakulteti Mjekësi.
