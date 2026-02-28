// QCM Templates for specific formation types
// Each template contains the questions, options, and correct answers
// Matched to formations by keywords in the title

export interface QCMQuestion {
  question: string;
  options: { letter: string; text: string }[];
  correct_answer: string;
}

export interface QCMTemplate {
  id: string;
  label: string;
  keywords: string[]; // matched against formation title (lowercase)
  questions: QCMQuestion[];
}

export const QCM_TEMPLATES: QCMTemplate[] = [
  {
    id: 'agent_augmente_immo',
    label: 'Agent Augmenté par l\'IA - Immobilier',
    keywords: ['agent augmenté', 'ia', 'immobilier', 'immo'],
    questions: [
      { question: "Combien de techniques d'IA connaissez-vous ?", options: [{ letter: 'A', text: '1 à 2' }, { letter: 'B', text: '3 à 5' }, { letter: 'C', text: 'Plus de 5' }, { letter: 'D', text: 'Aucune' }], correct_answer: 'C' },
      { question: "Quel est l'objectif principal de la formation ?", options: [{ letter: 'A', text: 'Vendre plus' }, { letter: 'B', text: "Comprendre et utiliser l'IA" }, { letter: 'C', text: 'Automatiser totalement' }, { letter: 'D', text: "Remplacer l'humain" }], correct_answer: 'B' },
      { question: "Quelle est la première étape de la méthode avancée ?", options: [{ letter: 'A', text: 'Analyser le besoin' }, { letter: 'B', text: 'Tester des outils' }, { letter: 'C', text: 'Automatiser' }, { letter: 'D', text: 'Optimiser' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA peut rédiger des mails automatiquement.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A' },
      { question: "Quel est le but de l'atelier Prompt Parfait ?", options: [{ letter: 'A', text: 'Créer des images' }, { letter: 'B', text: 'Rédiger des prompts efficaces' }, { letter: 'C', text: 'Coder une IA' }, { letter: 'D', text: 'Automatiser un CRM' }], correct_answer: 'B' },
      { question: "Quel est un des éléments à évaluer lors de la conception de prompt ?", options: [{ letter: 'A', text: 'La clarté' }, { letter: 'B', text: 'La longueur' }, { letter: 'C', text: 'La couleur' }, { letter: 'D', text: 'Le design' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA ne peut pas analyser les performances.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
      { question: "Quel est l'objectif de la rédaction optimisée ?", options: [{ letter: 'A', text: 'Faire du volume' }, { letter: 'B', text: 'Gagner du temps' }, { letter: 'C', text: "Améliorer l'impact commercial" }, { letter: 'D', text: 'Copier-coller' }], correct_answer: 'C' },
      { question: "Vrai ou faux : L'IA peut améliorer les photos immobilières.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA ne peut pas générer de bilans.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
      { question: "Quel est le rôle de l'IA dans le suivi vendeur ?", options: [{ letter: 'A', text: 'Envoyer des pubs' }, { letter: 'B', text: 'Analyser et personnaliser le suivi' }, { letter: 'C', text: "Remplacer l'agent immobilier" }, { letter: 'D', text: 'Archiver les dossiers' }], correct_answer: 'B' },
      { question: "Quel est un des bénéfices de l'IA pour les clients ?", options: [{ letter: 'A', text: 'Plus de complexité' }, { letter: 'B', text: 'Réponses plus rapides et personnalisées' }, { letter: 'C', text: 'Moins de contact humain' }, { letter: 'D', text: 'Moins de données' }], correct_answer: 'B' },
      { question: "Vrai ou faux : L'IA ne peut pas aider à la prospection.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
    ],
  },
  {
    id: 'agent_augmente_assurance',
    label: 'Agent Augmenté par l\'IA - Assurance',
    keywords: ['agent augmenté', 'ia', 'assurance'],
    questions: [
      { question: "Combien de techniques d'IA connaissez-vous ?", options: [{ letter: 'A', text: '1 à 2' }, { letter: 'B', text: '3 à 5' }, { letter: 'C', text: 'Plus de 5' }, { letter: 'D', text: 'Aucune' }], correct_answer: 'C' },
      { question: "Quel est l'objectif principal de la formation ?", options: [{ letter: 'A', text: 'Vendre plus' }, { letter: 'B', text: "Comprendre l'IA" }, { letter: 'C', text: 'Automatiser totalement' }, { letter: 'D', text: "Remplacer l'humain" }], correct_answer: 'B' },
      { question: "Quelle est la première étape de la méthode avancée ?", options: [{ letter: 'A', text: 'Analyser' }, { letter: 'B', text: 'Tester' }, { letter: 'C', text: 'Automatiser' }, { letter: 'D', text: 'Optimiser' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA peut rédiger des mails automatiquement.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A' },
      { question: "Quel est le but de l'atelier Prompt Parfait ?", options: [{ letter: 'A', text: 'Créer des images' }, { letter: 'B', text: 'Rédiger des prompts efficaces' }, { letter: 'C', text: 'Coder une IA' }, { letter: 'D', text: 'Automatiser un CRM' }], correct_answer: 'B' },
      { question: "Quel est un des éléments à évaluer lors de la conception de prompt ?", options: [{ letter: 'A', text: 'La clarté' }, { letter: 'B', text: 'La longueur' }, { letter: 'C', text: 'La couleur' }, { letter: 'D', text: 'Le design' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA ne peut pas analyser les performances.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
      { question: "Quel est l'objectif de la rédaction optimisée ?", options: [{ letter: 'A', text: 'Faire du volume' }, { letter: 'B', text: 'Gagner du temps' }, { letter: 'C', text: "Améliorer l'impact" }, { letter: 'D', text: 'Copier-coller' }], correct_answer: 'C' },
      { question: "Vrai ou faux : L'IA peut améliorer ma relation client.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'A' },
      { question: "Vrai ou faux : L'IA ne peut pas générer de bilans.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
      { question: "Quel est le rôle de l'IA dans le suivi client ?", options: [{ letter: 'A', text: 'Envoyer des pubs' }, { letter: 'B', text: 'Analyser et personnaliser' }, { letter: 'C', text: 'Remplacer le commercial' }, { letter: 'D', text: 'Archiver' }], correct_answer: 'B' },
      { question: "Quel est un des bénéfices de l'IA pour les clients ?", options: [{ letter: 'A', text: 'Plus de complexité' }, { letter: 'B', text: 'Réponses plus rapides' }, { letter: 'C', text: 'Moins de contact' }, { letter: 'D', text: 'Moins de données' }], correct_answer: 'B' },
      { question: "Vrai ou faux : L'IA ne peut pas aider à la prospection.", options: [{ letter: 'A', text: 'Vrai' }, { letter: 'B', text: 'Faux' }], correct_answer: 'B' },
    ],
  },
  {
    id: 'cadastre_j1',
    label: 'Cadastre.com - Jour 1',
    keywords: ['cadastre'],
    questions: [
      { question: "Quel onglet de Cadastre.com est crucial pour la localisation ?", options: [{ letter: 'A', text: 'DPE' }, { letter: 'B', text: 'Cartes' }, { letter: 'C', text: 'Annonces' }, { letter: 'D', text: 'Prospection' }], correct_answer: 'B' },
      { question: "Quelle fonction permet d'identifier des biens sous-évalués ?", options: [{ letter: 'A', text: 'Les alertes' }, { letter: 'B', text: "L'analyse comparative" }, { letter: 'C', text: 'Les annonces' }, { letter: 'D', text: 'La messagerie' }], correct_answer: 'B' },
      { question: "Comment maximiser la recherche de biens spécifiques ?", options: [{ letter: 'A', text: 'Recherche simple' }, { letter: 'B', text: 'Filtres avancés multicritères' }, { letter: 'C', text: 'Navigation libre' }, { letter: 'D', text: 'Tri aléatoire' }], correct_answer: 'B' },
      { question: "Quel est l'avantage de l'onglet DPE ?", options: [{ letter: 'A', text: 'Décorer les annonces' }, { letter: 'B', text: 'Analyser la performance énergétique' }, { letter: 'C', text: 'Fixer le prix' }, { letter: 'D', text: 'Créer des alertes' }], correct_answer: 'B' },
      { question: "Comment les alertes personnalisées améliorent-elles la veille ?", options: [{ letter: 'A', text: 'Elles ralentissent la recherche' }, { letter: 'B', text: 'Elles signalent les opportunités en temps réel' }, { letter: 'C', text: "Elles suppriment l'analyse" }, { letter: 'D', text: "Elles remplacent l'agent" }], correct_answer: 'B' },
      { question: "Quelle méthode permet de suivre les concurrents efficacement ?", options: [{ letter: 'A', text: 'Observation manuelle' }, { letter: 'B', text: 'Veille structurée et outils dédiés' }, { letter: 'C', text: 'Copie des annonces' }, { letter: 'D', text: 'Ignorer la concurrence' }], correct_answer: 'B' },
      { question: "Comment identifier les zones les plus prometteuses ?", options: [{ letter: 'A', text: 'Au hasard' }, { letter: 'B', text: 'Analyse des données et tendances' }, { letter: 'C', text: 'Par intuition' }, { letter: 'D', text: 'En suivant les concurrents' }], correct_answer: 'B' },
      { question: "Quelle stratégie optimise l'exploitation des données ?", options: [{ letter: 'A', text: 'Accumuler des données' }, { letter: 'B', text: 'Croiser et analyser les données' }, { letter: 'C', text: 'Ignorer certaines données' }, { letter: 'D', text: "Se fier à l'intuition" }], correct_answer: 'B' },
      { question: "Quel est le rôle de l'onglet Annonces dans la prospection ?", options: [{ letter: 'A', text: 'Informer uniquement' }, { letter: 'B', text: 'Détecter des opportunités commerciales' }, { letter: 'C', text: 'Créer des visuels' }, { letter: 'D', text: 'Archiver les biens' }], correct_answer: 'B' },
      { question: "Comment les cartes interactives facilitent-elles la prospection ?", options: [{ letter: 'A', text: "Elles compliquent l'analyse" }, { letter: 'B', text: 'Elles offrent une vision géographique claire' }, { letter: 'C', text: 'Elles remplacent les visites' }, { letter: 'D', text: 'Elles ralentissent le travail' }], correct_answer: 'B' },
      { question: "Comment l'onglet Prospection contribue-t-il au développement commercial ?", options: [{ letter: 'A', text: "Il n'aide pas" }, { letter: 'B', text: 'Il structure et cible les actions commerciales' }, { letter: 'C', text: 'Il remplace le commercial' }, { letter: 'D', text: 'Il automatise sans contrôle' }], correct_answer: 'B' },
      { question: "Quel est l'impact des notifications en temps réel sur la détection d'opportunités ?", options: [{ letter: 'A', text: 'Aucun' }, { letter: 'B', text: 'Réactivité accrue et gain de temps' }, { letter: 'C', text: "Surcharge d'informations" }, { letter: 'D', text: 'Blocage des actions' }], correct_answer: 'B' },
    ],
  },
  {
    id: 'cadastre_j2',
    label: 'Cadastre.com - Jour 2 (DVF & IA)',
    keywords: ['cadastre', 'dvf'],
    questions: [
      { question: "Quel est le principal avantage de l'outil DVF ?", options: [{ letter: 'A', text: 'Visualiser les annonces' }, { letter: 'B', text: 'Accéder aux prix réels des transactions' }, { letter: 'C', text: 'Créer des annonces' }, { letter: 'D', text: 'Automatiser la prospection' }], correct_answer: 'B' },
      { question: "Comment les données DVF améliorent-elles les estimations ?", options: [{ letter: 'A', text: 'En augmentant les prix' }, { letter: 'B', text: 'En se basant sur des données réelles et fiables' }, { letter: 'C', text: "En supprimant l'analyse humaine" }, { letter: 'D', text: "En remplaçant l'agent immobilier" }], correct_answer: 'B' },
      { question: "Quelle fonctionnalité de recherche avancée est la plus utile ?", options: [{ letter: 'A', text: 'La recherche par couleur' }, { letter: 'B', text: 'Les filtres multicritères' }, { letter: 'C', text: 'La géolocalisation GPS' }, { letter: 'D', text: 'Le tri aléatoire' }], correct_answer: 'B' },
      { question: "Pourquoi utiliser des filtres dans vos recherches DVF ?", options: [{ letter: 'A', text: 'Pour réduire le nombre de résultats' }, { letter: 'B', text: 'Pour obtenir des données plus pertinentes' }, { letter: 'C', text: "Pour compliquer l'analyse" }, { letter: 'D', text: 'Pour gagner du temps uniquement' }], correct_answer: 'B' },
      { question: "Quel impact a l'analyse des données DVF sur les tendances du marché ?", options: [{ letter: 'A', text: 'Aucun impact' }, { letter: 'B', text: "Permet d'anticiper les évolutions du marché" }, { letter: 'C', text: 'Ralentit les décisions' }, { letter: 'D', text: 'Supprime la concurrence' }], correct_answer: 'B' },
      { question: "Quelle est la meilleure stratégie pour exploiter les données du marché immobilier ?", options: [{ letter: 'A', text: "Se fier à l'intuition" }, { letter: 'B', text: 'Croiser les données et analyser les tendances' }, { letter: 'C', text: 'Copier les concurrents' }, { letter: 'D', text: 'Ignorer les données' }], correct_answer: 'B' },
      { question: "Pourquoi est-il crucial de comprendre les données DVF dans l'immobilier ?", options: [{ letter: 'A', text: 'Pour faire joli' }, { letter: 'B', text: 'Pour sécuriser les estimations et décisions' }, { letter: 'C', text: 'Pour remplacer le notaire' }, { letter: 'D', text: 'Pour éviter les visites' }], correct_answer: 'B' },
      { question: "Comment maximiser l'utilisation des outils IA dans l'analyse immobilière ?", options: [{ letter: 'A', text: 'En automatisant sans réfléchir' }, { letter: 'B', text: "En combinant expertise humaine et IA" }, { letter: 'C', text: "En supprimant l'humain" }, { letter: 'D', text: "En utilisant un seul outil" }], correct_answer: 'B' },
      { question: "Quel est l'impact de l'analyse des prix au mètre carré sur les décisions d'achat ?", options: [{ letter: 'A', text: 'Aucun' }, { letter: 'B', text: 'Aide à prendre des décisions éclairées' }, { letter: 'C', text: 'Augmente systématiquement les prix' }, { letter: 'D', text: 'Bloque les ventes' }], correct_answer: 'B' },
      { question: "Comment l'approche stratégique influence-t-elle la prospection ?", options: [{ letter: 'A', text: "Elle n'a aucun effet" }, { letter: 'B', text: 'Elle permet de cibler plus efficacement' }, { letter: 'C', text: 'Elle ralentit la prospection' }, { letter: 'D', text: 'Elle remplace le relationnel' }], correct_answer: 'B' },
      { question: "Quelle est la valeur ajoutée des outils de communication cross-canal ?", options: [{ letter: 'A', text: 'Multiplier les messages inutiles' }, { letter: 'B', text: "Améliorer la cohérence et l'impact commercial" }, { letter: 'C', text: 'Remplacer le commercial' }, { letter: 'D', text: 'Réduire les échanges' }], correct_answer: 'B' },
      { question: "Comment les données DVF améliorent-elles la vision du marché ?", options: [{ letter: 'A', text: 'En rendant les biens plus chers' }, { letter: 'B', text: 'En apportant une vision objective du marché' }, { letter: 'C', text: 'En supprimant les négociations' }, { letter: 'D', text: 'En standardisant tous les biens' }], correct_answer: 'B' },
    ],
  },
  {
    id: 'prospection_immobiliere',
    label: 'Prospection Immobilière',
    keywords: ['prospection'],
    questions: [
      { question: "Qu'est-ce que la prospection commerciale immobilière ?", options: [{ letter: 'A', text: 'La gestion des ventes' }, { letter: 'B', text: 'La recherche active de nouveaux mandats et clients' }, { letter: 'C', text: 'La signature des compromis' }, { letter: 'D', text: 'La gestion locative' }], correct_answer: 'B' },
      { question: "Qu'est-ce que la sphère d'influence ?", options: [{ letter: 'A', text: 'Un secteur géographique' }, { letter: 'B', text: "L'ensemble des personnes qui vous connaissent et peuvent vous recommander" }, { letter: 'C', text: 'Les clients acheteurs' }, { letter: 'D', text: 'Les prospects froids' }], correct_answer: 'B' },
      { question: "Comment pouvez-vous capter de nouveaux clients sur les réseaux sociaux ?", options: [{ letter: 'A', text: 'En publiant sans stratégie' }, { letter: 'B', text: 'En apportant de la valeur et en étant régulier' }, { letter: 'C', text: 'En faisant uniquement de la publicité' }, { letter: 'D', text: 'En copiant les concurrents' }], correct_answer: 'B' },
      { question: "Quelle est la meilleure approche pour aborder un propriétaire par téléphone ?", options: [{ letter: 'A', text: 'Être direct et insistant' }, { letter: 'B', text: "Être à l'écoute et créer une relation de confiance" }, { letter: 'C', text: 'Lire un script sans adaptation' }, { letter: 'D', text: 'Parler uniquement du prix' }], correct_answer: 'B' },
      { question: "Qu'est-ce que la règle des 7 appels sur 7 semaines ?", options: [{ letter: 'A', text: 'Appeler 7 fois le même jour' }, { letter: 'B', text: 'Répéter des contacts réguliers pour créer une relation' }, { letter: 'C', text: 'Relancer uniquement une fois' }, { letter: 'D', text: 'Automatiser tous les appels' }], correct_answer: 'B' },
      { question: "Il est impératif d'adapter votre message à chaque personne que vous rencontrez ?", options: [{ letter: 'A', text: 'Faux' }, { letter: 'B', text: 'Vrai' }], correct_answer: 'B' },
      { question: "Comment pouvez-vous repérer un bien à vendre en porte à porte ?", options: [{ letter: 'A', text: 'En parlant uniquement du prix' }, { letter: 'B', text: 'En posant les bonnes questions et en observant' }, { letter: 'C', text: 'En laissant une carte sans échange' }, { letter: 'D', text: 'En forçant la discussion' }], correct_answer: 'B' },
      { question: "Quel est l'objectif final de la prospection commerciale immobilière ?", options: [{ letter: 'A', text: "Faire du volume d'appels" }, { letter: 'B', text: 'Obtenir des mandats qualifiés' }, { letter: 'C', text: 'Remplir un CRM' }, { letter: 'D', text: 'Distribuer des flyers' }], correct_answer: 'B' },
      { question: "Comment pouvez-vous entretenir votre sphère d'influence ?", options: [{ letter: 'A', text: "En contactant uniquement quand vous avez besoin" }, { letter: 'B', text: 'En maintenant un lien régulier et personnalisé' }, { letter: 'C', text: 'En envoyant des messages automatiques' }, { letter: 'D', text: 'En ne communiquant pas' }], correct_answer: 'B' },
      { question: "Proposer une estimation gratuite et sans engagement permet d'obtenir des contacts qualifiés ?", options: [{ letter: 'A', text: 'Faux' }, { letter: 'B', text: 'Vrai' }], correct_answer: 'B' },
    ],
  },
  {
    id: 'recrutement_gagnant',
    label: 'Recrutement Gagnant',
    keywords: ['recrutement'],
    questions: [
      { question: "Quelle est la première étape pour recruter en continu et de manière efficace ?", options: [{ letter: 'A', text: 'Publier une annonce' }, { letter: 'B', text: 'Définir clairement le profil recherché' }, { letter: 'C', text: 'Attendre les candidatures' }, { letter: 'D', text: 'Déléguer le recrutement' }], correct_answer: 'B' },
      { question: "Quel rôle jouent vos agents actuels dans le processus de recrutement ?", options: [{ letter: 'A', text: 'Aucun rôle' }, { letter: 'B', text: 'Ils peuvent recommander et attirer des profils' }, { letter: 'C', text: 'Ils remplacent les recruteurs' }, { letter: 'D', text: 'Ils gèrent les contrats' }], correct_answer: 'B' },
      { question: "À quelle fréquence devriez-vous consacrer du temps à la prospection pour le recrutement ?", options: [{ letter: 'A', text: 'Une fois par mois' }, { letter: 'B', text: 'Régulièrement chaque semaine' }, { letter: 'C', text: "Uniquement en cas d'urgence" }, { letter: 'D', text: 'Une fois par an' }], correct_answer: 'B' },
      { question: "Quels critères pouvez-vous utiliser pour évaluer l'efficacité de votre recrutement ?", options: [{ letter: 'A', text: 'Nombre de candidatures' }, { letter: 'B', text: 'Qualité des profils recrutés' }, { letter: 'C', text: 'Taux de transformation entretien/embauche' }, { letter: 'D', text: 'Ancienneté des recrues' }], correct_answer: 'B' },
      { question: "Quelle est l'importance de l'atmosphère lors d'un entretien d'embauche ?", options: [{ letter: 'A', text: 'Aucune importance' }, { letter: 'B', text: 'Elle favorise un échange authentique' }, { letter: 'C', text: 'Elle est secondaire' }, { letter: 'D', text: 'Elle ralentit le processus' }], correct_answer: 'B' },
      { question: "Comment devriez-vous accueillir un candidat pour un entretien ?", options: [{ letter: 'A', text: 'De manière froide et formelle' }, { letter: 'B', text: 'Avec bienveillance et professionnalisme' }, { letter: 'C', text: 'En restant distant' }, { letter: 'D', text: 'En allant droit au CV' }], correct_answer: 'B' },
      { question: "Quelle technique est recommandée pour briser la glace au début d'un entretien ?", options: [{ letter: 'A', text: 'Poser des questions pièges' }, { letter: 'B', text: 'Engager une discussion informelle' }, { letter: 'C', text: 'Parler uniquement du poste' }, { letter: 'D', text: 'Lire le CV mot pour mot' }], correct_answer: 'B' },
      { question: "Quel est l'objectif principal du premier entretien avec un candidat ?", options: [{ letter: 'A', text: 'Signer un contrat' }, { letter: 'B', text: 'Évaluer le potentiel et la motivation' }, { letter: 'C', text: 'Tester les connaissances techniques' }, { letter: 'D', text: 'Parler du salaire uniquement' }], correct_answer: 'B' },
      { question: "Pourquoi est-il important d'analyser vos ratios de performance en recrutement ?", options: [{ letter: 'A', text: 'Pour compliquer le suivi' }, { letter: 'B', text: "Pour améliorer l'efficacité du recrutement" }, { letter: 'C', text: 'Pour réduire les entretiens' }, { letter: 'D', text: 'Pour supprimer le relationnel' }], correct_answer: 'B' },
      { question: "Que doit refléter une annonce de recrutement pour attirer les bons candidats ?", options: [{ letter: 'A', text: 'Uniquement le salaire' }, { letter: 'B', text: 'La culture, les valeurs et les opportunités' }, { letter: 'C', text: 'Les contraintes uniquement' }, { letter: 'D', text: 'Un discours standard' }], correct_answer: 'B' },
    ],
  },
];

/**
 * Find the best matching QCM template for a formation based on its title and programme.
 * Uses keyword matching with priority scoring.
 * Returns null if no template matches (AI fallback should be used).
 */
export function findMatchingQCMTemplate(formationTitre: string, programme?: string | null): QCMTemplate | null {
  const searchText = `${formationTitre} ${programme || ''}`.toLowerCase();

  // Special case: Cadastre formations - differentiate J1 vs J2 by DVF/IA keywords
  const isCadastre = searchText.includes('cadastre');
  const hasDVF = searchText.includes('dvf') || searchText.includes('jour 2') || searchText.includes('j2');

  if (isCadastre) {
    if (hasDVF) {
      return QCM_TEMPLATES.find(t => t.id === 'cadastre_j2') || null;
    }
    return QCM_TEMPLATES.find(t => t.id === 'cadastre_j1') || null;
  }

  // Special case: Agent Augmenté - differentiate Immo vs Assurance
  const isAgentAugmente = searchText.includes('agent augmenté') || (searchText.includes('ia') && searchText.includes('agent'));
  if (isAgentAugmente) {
    if (searchText.includes('assurance')) {
      return QCM_TEMPLATES.find(t => t.id === 'agent_augmente_assurance') || null;
    }
    // Default to Immo for agent augmenté
    return QCM_TEMPLATES.find(t => t.id === 'agent_augmente_immo') || null;
  }

  // Score each template by keyword matches
  let bestTemplate: QCMTemplate | null = null;
  let bestScore = 0;

  for (const template of QCM_TEMPLATES) {
    // Skip cadastre and agent augmenté (already handled above)
    if (template.id.startsWith('cadastre') || template.id.startsWith('agent_augmente')) continue;

    const matchCount = template.keywords.filter(kw => searchText.includes(kw)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestTemplate = template;
    }
  }

  return bestScore > 0 ? bestTemplate : null;
}
