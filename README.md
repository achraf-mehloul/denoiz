# Denoiz — Clean Signal, Safe Life

Plateforme frontend de monitoring ECG en temps réel. Streaming Bluetooth Low Energy, visualisation d'ondes, analyse HRV, détection QRS, marquage d'arythmies, enregistrement, relecture, comparaison, et export — sans serveur, sans compte, sans télémétrie.

## Table des matières

- Vue d'ensemble
- Fonctionnalités
- Architecture technique
- Compatibilité navigateurs
- Structure du projet
- Utilisation
- Confidentialité et données

## Vue d'ensemble

Denoiz s'exécute intégralement dans le navigateur. Aucune donnée n'est envoyée à un serveur distant. Le stockage repose sur IndexedDB et localStorage. La communication avec les capteurs utilise l'API Web Bluetooth (GATT).

## Fonctionnalités

### Connectivité Bluetooth Low Energy

- Appairage de capteurs BLE via l'API Web Bluetooth standard
- Trois modes de scan sélectionnables : Heart Rate standard, filtrage par UUID de services, ou tous les périphériques BLE proches
- Support des capteurs Heart Rate GATT standard (service 0x180D)
- Support des caractéristiques de flux ECG brut personnalisées (UUID de service et de caractéristique configurables)
- Décodage automatique des intervalles RR contenus dans les paquets Heart Rate Measurement
- Lecture du niveau de batterie via le Battery Service (0x180F) lorsqu'exposé
- Reconnexion automatique avec backoff exponentiel après déconnexion
- Mémorisation du dernier appareil entre les sessions
- Détection navigateur avec messages explicites (Safari iOS, Firefox, HTTPS requis, permissions système)
- Suivi du débit paquets par seconde, du jitter, et du taux de perte

### Traitement de signal temps réel

- Buffer circulaire tri-canal (brut, bruité, filtré) à 250 Hz sur 12 secondes
- Pipeline DSP configurable : passe-haut, passe-bas, notch 50/60 Hz
- Calibration linéaire persistante (gain et offset) appliquée à chaque échantillon
- Détection QRS Pan-Tompkins pour marquage visuel des pics R
- Calcul HRV en fenêtre glissante : RMSSD, SDNN, pNN50, moyenne RR
- Évaluation automatique de bradycardie, tachycardie et irrégularité

### Interface

- Tableau de bord bento-grid adaptatif avec hiérarchie visuelle
- Hero-BPM pleine largeur sur mobile avec chiffres 104 px et animation heartbeat
- Onde ECG rendue sur canvas avec surimpression des pics R et grille millimétrique
- Historique HR (mini graphique) mis à jour à chaque nouvelle mesure
- Barre de statut persistante affichant état BLE, BPM, débit paquets, indicateur d'enregistrement
- Bottom-nav mobile intelligent (Moniteur, Sessions, Analyse, Réglages) + sheet Plus (Bluetooth, Relecture, Comparaison, Correction)
- Sticky mini-waveform s'affichant automatiquement lorsque la vue principale sort du viewport
- Pull-to-refresh sur mobile déclenchant une reconnexion BLE
- FAB (bouton d'action flottant) dédié à l'enregistrement sur mobile
- Retour haptique (navigator.vibrate) synchronisé sur chaque battement détecté
- Prise en charge des safe-area-insets iOS (encoche, home indicator)
- Thème sombre et clair basculables, préférence persistée localement
- Typographie professionnelle : Space Grotesk (display) et JetBrains Mono (chiffres)

### Enregistrement, relecture, comparaison

- Enregistrement de sessions complètes (canaux brut, bruité, filtré + série BPM)
- Persistance IndexedDB avec pagination pour supporter de nombreuses sessions
- Relecture avec contrôles clavier (Espace, flèches, plus/moins) et vitesse variable
- Annotations horodatées sur la timeline de relecture
- Comparaison côte à côte de deux sessions
- Correction manuelle du signal avec pipeline DSP paramétrable
- Export PNG des rapports avec métadonnées (BPM, durée, appareil, horodatage) et pied de page marqué

### Analyse

- Page Analyse dédiée agrégeant les métriques HRV sur historique
- Détection d'arythmie avec drapeaux colorés (normal, brady, tachy, irrégulier)
- Analyse HRV court terme (fenêtre 2 minutes) affichée directement sur le dashboard

### Mode démo

- Lecteur de démonstration streamant un signal ECG réel MIT-BIH ré-échantillonné
- Activable manuellement depuis la barre de statut ou le dashboard
- N'écrase jamais un capteur BLE connecté

### Notifications locales

- Alerte système en cas de déconnexion du capteur pendant un enregistrement
- Utilise l'API Notification standard, aucune infrastructure push requise
- Activation explicite depuis Réglages → Notifications

### PWA

- Manifest web complet (icônes 192, 512, maskable, theme-color, apple-touch-icon)
- Meta viewport avec viewport-fit=cover pour l'affichage plein écran sur iOS
- Prêt pour installation Add-to-Home-Screen sur Android et iOS

## Architecture technique

- React 19
- TanStack Start avec routage basé fichiers
- TypeScript strict
- Tailwind CSS v4 avec tokens sémantiques OKLCH
- Framer Motion pour transitions et micro-interactions (layoutId, spring)
- shadcn/ui (Sheet, Dialog, Slider, etc.)
- lucide-react pour l'iconographie
- IndexedDB via wrapper maison pour la persistance
- Canvas 2D pour le rendu des ondes
- html-to-image pour l'export PNG
- API Web Bluetooth, API Notification, API Wake Lock, API Vibration

## Compatibilité navigateurs

- Chrome, Edge, Opera sur Desktop (Windows, macOS, Linux) et Android : support complet
- Safari (iOS, iPadOS, macOS) : Web Bluetooth non exposé. Le navigateur Bluefy est recommandé sur iOS
- Firefox : Web Bluetooth non supporté par défaut
- HTTPS est requis pour Web Bluetooth (sauf localhost)

## Structure du projet

```
src/
  components/
    AppShell.tsx           Layout, sidebar desktop, bottom-nav mobile
    StatusBar.tsx          Barre de statut persistante
    EcgWaveform.tsx        Canvas temps réel avec pics R
    BpmHistory.tsx         Mini-graphique HR
    HrvPanel.tsx           Métriques HRV
    ArrhythmiaFlags.tsx    Drapeaux d'arythmie
    StatTile.tsx           Tuile métrique
    EmptyState.tsx         État vide illustré
    BleIllustration.tsx    Illustration SVG capteur
  lib/
    bluetooth.ts           Adaptateur Web Bluetooth
    signal.ts              Store central du signal
    dsp.ts                 Pipeline DSP
    analytics.ts           HRV, QRS, arythmie
    calibration.ts         Calibration linéaire
    db.ts                  IndexedDB
    demo.ts                Lecteur démo
    theme.ts               Thème sombre/clair
    notify.ts              Notifications locales
    snapshot.ts            Export PNG
    annotations.ts         Annotations relecture
    export.ts              Export JSON de session
    format.ts              Formatage
  routes/
    __root.tsx             Route racine, meta, head
    _app.tsx               Layout applicatif
    _app/index.tsx         Tableau de bord
    _app/bluetooth.tsx     Centre Bluetooth
    _app/sessions.tsx      Sessions enregistrées
    _app/replay.tsx        Relecture
    _app/compare.tsx       Comparaison
    _app/correction.tsx    Correction manuelle
    _app/analytics.tsx     Analyse
    _app/settings.tsx      Réglages
  styles.css               Tokens de design, utilitaires
public/
  denoiz-logo.jpg          Logo
  manifest.webmanifest     Manifest PWA
  demo-ecg.json            Signal de démonstration
```

## Utilisation

Installation et démarrage :

```bash
bun install
bun run dev
```

Appairage d'un capteur :

1. Ouvrir Denoiz dans Chrome, Edge ou Opera via HTTPS
2. Aller sur la page Bluetooth
3. Cliquer sur Connecter et sélectionner le capteur dans la boîte de dialogue système
4. Le tableau de bord affiche automatiquement les mesures dès réception du premier paquet

Configuration d'un flux ECG brut personnalisé :

1. Aller sur Réglages → Bluetooth
2. Renseigner l'UUID du service et de la caractéristique brute (Float32 little-endian, notify)
3. Sauvegarder — la reconnexion suivante s'abonne automatiquement au flux

## Confidentialité et données

- Aucun serveur backend, aucune API distante appelée
- Toutes les sessions sont conservées dans IndexedDB local
- Les préférences sont conservées dans localStorage local
- Les notifications sont locales (API Notification native), aucun serveur push
- Les données peuvent être exportées en JSON ou PNG à la demande de l'utilisateur
- Le bouton Effacer toutes les sessions dans Réglages supprime définitivement l'ensemble des enregistrements

## Licence

Projet propriétaire. Denoiz — Clean Signal, Safe Life.
