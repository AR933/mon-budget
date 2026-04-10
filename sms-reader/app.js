// ===== SMS Assistant - Application principale =====

(function () {
    'use strict';

    // --- Constantes ---
    var STORAGE_KEY = 'sms_assistant_history';
    var STATUS_KEY = 'sms_assistant_busy';

    // --- État ---
    var isBusy = JSON.parse(localStorage.getItem(STATUS_KEY) || 'false');

    // --- Éléments DOM ---
    var smsInput = document.getElementById('smsInput');
    var phoneNumber = document.getElementById('phoneNumber');
    var analyzeBtn = document.getElementById('analyzeBtn');
    var suggestionsSection = document.getElementById('suggestionsSection');
    var suggestionsList = document.getElementById('suggestionsList');
    var historyList = document.getElementById('historyList');
    var clearHistoryBtn = document.getElementById('clearHistoryBtn');
    var toggleBtn = document.getElementById('toggleBtn');
    var statusLabel = document.getElementById('statusLabel');
    var modalOverlay = document.getElementById('modalOverlay');
    var modalMessage = document.getElementById('modalMessage');
    var modalCancel = document.getElementById('modalCancel');
    var modalCopy = document.getElementById('modalCopy');
    var modalSend = document.getElementById('modalSend');
    var toast = document.getElementById('toast');

    // --- Catégories de messages et mots-clés ---
    var messagePatterns = {
        greeting: {
            keywords: ['salut', 'bonjour', 'coucou', 'hello', 'hey', 'bonsoir', 'yo', 'wesh', 'slt', 'bjr', 'cc'],
            label: 'Salutation'
        },
        question: {
            keywords: ['?', 'est-ce que', 'comment', 'pourquoi', 'quand', 'combien', 'qui', 'quoi', 'quel', 'quelle'],
            label: 'Question'
        },
        invitation: {
            keywords: ['dîner', 'diner', 'manger', 'boire', 'sortir', 'venir', 'rejoindre', 'soirée', 'soiree', 'fête', 'fete', 'apéro', 'apero', 'resto', 'restaurant', 'bar', 'ciné', 'cine', 'cinéma', 'cinema', 'on se voit', 'tu viens', 'ça te dit', 'ca te dit', 'rendez-vous', 'rdv'],
            label: 'Invitation'
        },
        meetup: {
            keywords: ['quand', 'heure', 'rendez-vous', 'rdv', 'retrouver', 'rejoindre', 'à quelle heure', 'demain', 'ce soir', 'samedi', 'dimanche', 'week-end', 'weekend', 'disponible', 'dispo', 'libre'],
            label: 'Rendez-vous'
        },
        urgent: {
            keywords: ['urgent', 'urgence', 'vite', 'rapidement', 'asap', 'important', 'immédiatement', 'immediatement', 'tout de suite', 'appelle', 'rappelle', 'stp', 'svp', 'besoin'],
            label: 'Urgent'
        },
        thanks: {
            keywords: ['merci', 'remercie', 'merci beaucoup', 'top', 'parfait', 'super', 'génial', 'genial', 'nickel', 'cool', 'trop bien'],
            label: 'Remerciement'
        },
        news: {
            keywords: ['comment ça va', 'comment ca va', 'ça va', 'ca va', 'quoi de neuf', 'nouvelles', 'la forme', 'tu vas bien', 'comment tu vas', 'comment vas-tu'],
            label: 'Nouvelles'
        },
        favor: {
            keywords: ['peux-tu', 'pourrais-tu', 'tu peux', 'tu pourrais', 'aide', 'aider', 'service', 'besoin de', 'prêter', 'preter', 'emprunter', 'donner un coup de main'],
            label: 'Demande'
        },
        confirmation: {
            keywords: ['ok', 'oui', 'd\'accord', 'entendu', 'ça marche', 'ca marche', 'c\'est noté', 'noté', 'note', 'bien reçu', 'bien recu', 'compris', 'validé', 'valide', 'confirme'],
            label: 'Confirmation'
        },
        apology: {
            keywords: ['désolé', 'desole', 'pardon', 'excuse', 'excuses', 'navré', 'navre', 'je regrette', 'pas pu', 'retard'],
            label: 'Excuse'
        },
        money: {
            keywords: ['argent', 'euros', '€', 'payer', 'rembourser', 'dette', 'virement', 'transfert', 'combien je te dois', 'tu me dois', 'prix', 'coût', 'cout'],
            label: 'Argent'
        }
    };

    // --- Réponses disponibles par catégorie et mode ---
    var responseTemplates = {
        greeting: {
            available: [
                { text: 'Salut ! Comment ça va ?', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Bonjour ! Tout va bien de mon côté, et toi ?', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Hey ! Quoi de neuf ?', tag: 'Amical', tagClass: 'tag-casual' }
            ],
            busy: [
                { text: 'Salut ! Je suis un peu occupé là, je te recontacte dès que possible.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Hello ! Je ne suis pas trop dispo pour le moment, on se parle plus tard ?', tag: 'Occupé', tagClass: 'tag-busy' }
            ]
        },
        question: {
            available: [
                { text: 'Bonne question ! Laisse-moi vérifier et je te dis ça.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Je regarde ça et je te tiens au courant.', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Oui, bien sûr ! Tu veux plus de détails ?', tag: 'Court', tagClass: 'tag-short' }
            ],
            busy: [
                { text: 'Je suis occupé pour le moment, je te réponds dès que possible.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Je regarde ça dès que je suis libre, désolé du délai !', tag: 'Occupé', tagClass: 'tag-busy' }
            ]
        },
        invitation: {
            available: [
                { text: 'Avec plaisir ! C\'est à quelle heure et où ?', tag: 'Enthousiaste', tagClass: 'tag-casual' },
                { text: 'Ça me tente bien ! Tu as un endroit en tête ?', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Super idée ! Je suis partant(e), dis-moi les détails.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Merci pour l\'invitation, mais je ne suis pas sûr(e) de pouvoir. Je te confirme.', tag: 'Prudent', tagClass: 'tag-formal' }
            ],
            busy: [
                { text: 'C\'est gentil mais je suis pris(e) en ce moment. On remet ça ?', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'J\'aurais adoré mais je ne suis pas disponible. Une prochaine fois ?', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Désolé(e), pas possible pour moi cette fois-ci !', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        meetup: {
            available: [
                { text: 'Je suis dispo ! Dis-moi l\'heure et le lieu.', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Ça marche pour moi. On se retrouve où ?', tag: 'Court', tagClass: 'tag-short' },
                { text: 'Parfait, c\'est noté ! À tout à l\'heure.', tag: 'Poli', tagClass: 'tag-formal' }
            ],
            busy: [
                { text: 'Je ne suis pas libre pour le moment, je te dis dès que je me libère.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Pas dispo là, on décale ?', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        urgent: {
            available: [
                { text: 'J\'ai vu ton message, je m\'en occupe tout de suite.', tag: 'Réactif', tagClass: 'tag-formal' },
                { text: 'C\'est noté, je fais au plus vite !', tag: 'Court', tagClass: 'tag-short' },
                { text: 'Je suis dessus. Je te tiens informé(e).', tag: 'Poli', tagClass: 'tag-formal' }
            ],
            busy: [
                { text: 'J\'ai bien noté l\'urgence. Je fais mon possible pour regarder ça rapidement.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Je suis occupé mais je vois que c\'est urgent. Je reviens vers toi dès que possible.', tag: 'Occupé', tagClass: 'tag-busy' }
            ]
        },
        thanks: {
            available: [
                { text: 'De rien, avec plaisir !', tag: 'Court', tagClass: 'tag-short' },
                { text: 'Pas de quoi, c\'est normal !', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Je t\'en prie, n\'hésite pas si tu as besoin d\'autre chose.', tag: 'Poli', tagClass: 'tag-formal' }
            ],
            busy: [
                { text: 'De rien !', tag: 'Court', tagClass: 'tag-busy' },
                { text: 'Pas de souci !', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        news: {
            available: [
                { text: 'Ça va bien merci ! Et toi, quoi de beau ?', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Très bien, merci de demander ! La forme et toi ?', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Tranquille ! Quoi de neuf de ton côté ?', tag: 'Amical', tagClass: 'tag-casual' }
            ],
            busy: [
                { text: 'Ça va mais un peu débordé(e) ! On se reparle bientôt ?', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Bien mais très occupé(e) là, je te recontacte !', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        favor: {
            available: [
                { text: 'Bien sûr, dis-moi comment je peux t\'aider.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Pas de problème ! C\'est quoi exactement ?', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Avec plaisir, je regarde ça.', tag: 'Court', tagClass: 'tag-short' }
            ],
            busy: [
                { text: 'Je voudrais bien t\'aider mais je suis pris(e) là. Je peux regarder ça plus tard ?', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Désolé(e), pas dispo tout de suite. Je te reviens là-dessus.', tag: 'Occupé', tagClass: 'tag-busy' }
            ]
        },
        confirmation: {
            available: [
                { text: 'Parfait, c\'est noté !', tag: 'Court', tagClass: 'tag-short' },
                { text: 'Super, merci pour la confirmation !', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Top ! À bientôt alors.', tag: 'Décontracté', tagClass: 'tag-casual' }
            ],
            busy: [
                { text: 'Bien reçu, merci !', tag: 'Court', tagClass: 'tag-busy' },
                { text: 'OK noté !', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        apology: {
            available: [
                { text: 'Pas de souci, ne t\'inquiète pas !', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'Ce n\'est rien, pas de problème.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'T\'inquiète, c\'est pas grave !', tag: 'Amical', tagClass: 'tag-casual' }
            ],
            busy: [
                { text: 'Pas de souci ! On en reparle plus tard.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'C\'est rien, t\'inquiète.', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        money: {
            available: [
                { text: 'Pas de problème, on règle ça quand tu veux.', tag: 'Décontracté', tagClass: 'tag-casual' },
                { text: 'D\'accord, je regarde ça et je te fais un retour.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'C\'est noté, merci de me le rappeler.', tag: 'Court', tagClass: 'tag-short' }
            ],
            busy: [
                { text: 'Bien noté, je regarde ça dès que je suis dispo.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'OK je m\'en occupe plus tard.', tag: 'Court', tagClass: 'tag-busy' }
            ]
        },
        generic: {
            available: [
                { text: 'Merci pour ton message ! Je te réponds dès que possible.', tag: 'Poli', tagClass: 'tag-formal' },
                { text: 'Bien reçu, je reviens vers toi.', tag: 'Court', tagClass: 'tag-short' },
                { text: 'OK, je note. On en reparle !', tag: 'Décontracté', tagClass: 'tag-casual' }
            ],
            busy: [
                { text: 'Je suis occupé(e) pour le moment, je te réponds dès que je peux.', tag: 'Occupé', tagClass: 'tag-busy' },
                { text: 'Pas dispo là, je reviens vers toi rapidement.', tag: 'Court', tagClass: 'tag-busy' },
                { text: 'Bien reçu ! Je suis en plein truc, je te recontacte.', tag: 'Occupé', tagClass: 'tag-busy' }
            ]
        }
    };

    // --- Fonctions utilitaires ---

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
        }, 2500);
    }

    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        var options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleDateString('fr-FR', options);
    }

    // --- Analyse du message ---

    function analyzeMessage(text) {
        var lowerText = text.toLowerCase().trim();
        var detectedCategories = [];

        // Vérifier chaque pattern
        for (var category in messagePatterns) {
            var pattern = messagePatterns[category];
            for (var i = 0; i < pattern.keywords.length; i++) {
                if (lowerText.indexOf(pattern.keywords[i]) !== -1) {
                    detectedCategories.push(category);
                    break;
                }
            }
        }

        // Si rien trouvé, catégorie générique
        if (detectedCategories.length === 0) {
            detectedCategories.push('generic');
        }

        return detectedCategories;
    }

    function getSuggestions(categories) {
        var mode = isBusy ? 'busy' : 'available';
        var suggestions = [];
        var seen = {};

        // Prioriser : urgent > invitation > meetup > favor > money > question > greeting > news > thanks > confirmation > apology > generic
        var priority = ['urgent', 'invitation', 'meetup', 'favor', 'money', 'question', 'greeting', 'news', 'thanks', 'confirmation', 'apology', 'generic'];

        // Trier les catégories par priorité
        categories.sort(function (a, b) {
            return priority.indexOf(a) - priority.indexOf(b);
        });

        for (var i = 0; i < categories.length; i++) {
            var cat = categories[i];
            var templates = responseTemplates[cat];
            if (!templates) continue;

            var responses = templates[mode] || templates.available;
            for (var j = 0; j < responses.length; j++) {
                if (!seen[responses[j].text] && suggestions.length < 5) {
                    seen[responses[j].text] = true;
                    suggestions.push(responses[j]);
                }
            }
        }

        // Compléter avec des réponses génériques si pas assez
        if (suggestions.length < 3) {
            var genericResponses = responseTemplates.generic[mode];
            for (var k = 0; k < genericResponses.length; k++) {
                if (!seen[genericResponses[k].text] && suggestions.length < 5) {
                    seen[genericResponses[k].text] = true;
                    suggestions.push(genericResponses[k]);
                }
            }
        }

        return suggestions;
    }

    // --- Affichage des suggestions ---

    function renderSuggestions(suggestions) {
        suggestionsList.innerHTML = '';

        for (var i = 0; i < suggestions.length; i++) {
            (function (suggestion) {
                var card = document.createElement('div');
                card.className = 'suggestion-card' + (isBusy ? ' busy-response' : '');
                card.innerHTML =
                    '<span class="suggestion-tag ' + suggestion.tagClass + '">' + suggestion.tag + '</span>' +
                    '<p class="suggestion-text">' + escapeHtml(suggestion.text) + '</p>' +
                    '<p class="suggestion-action">Appuyer pour sélectionner</p>';

                card.addEventListener('click', function () {
                    openModal(suggestion.text);
                });

                suggestionsList.appendChild(card);
            })(suggestions[i]);
        }

        suggestionsSection.style.display = 'block';
        suggestionsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Modal ---

    var selectedResponse = '';

    function openModal(responseText) {
        selectedResponse = responseText;
        modalMessage.textContent = responseText;

        var phone = phoneNumber.value.trim();
        if (phone) {
            modalSend.href = 'sms:' + encodeURIComponent(phone) + '?body=' + encodeURIComponent(responseText);
            modalSend.style.display = '';
        } else {
            modalSend.href = '#';
            modalSend.style.display = 'none';
        }

        modalOverlay.style.display = 'flex';
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        selectedResponse = '';
    }

    // --- Historique ---

    function addToHistory(originalMessage, response, wasReplied) {
        var history = getHistory();
        history.unshift({
            id: Date.now(),
            message: originalMessage,
            response: response || null,
            status: wasReplied ? 'replied' : 'skipped',
            date: new Date().toISOString(),
            wasBusy: isBusy
        });

        // Garder max 50 entrées
        if (history.length > 50) {
            history = history.slice(0, 50);
        }

        saveHistory(history);
        renderHistory();
    }

    function renderHistory() {
        var history = getHistory();

        if (history.length === 0) {
            historyList.innerHTML = '<p class="empty-state">Aucun message analysé pour le moment.</p>';
            return;
        }

        historyList.innerHTML = '';

        for (var i = 0; i < history.length; i++) {
            var entry = history[i];
            var card = document.createElement('div');
            card.className = 'history-card';

            var statusClass = entry.status === 'replied' ? 'status-replied' : 'status-skipped';
            var statusText = entry.status === 'replied' ? 'Répondu' : 'Lu';

            var html =
                '<div class="history-meta">' +
                    '<span class="history-date">' + formatDate(entry.date) + '</span>' +
                    '<span class="history-status ' + statusClass + '">' + statusText + '</span>' +
                '</div>' +
                '<div class="history-message"><strong>Message reçu :</strong>' + escapeHtml(entry.message) + '</div>';

            if (entry.response) {
                html += '<div class="history-response"><strong>Réponse :</strong>' + escapeHtml(entry.response) + '</div>';
            }

            card.innerHTML = html;
            historyList.appendChild(card);
        }
    }

    // --- Toggle Occupé/Disponible ---

    function updateToggleUI() {
        if (isBusy) {
            toggleBtn.classList.add('busy');
            statusLabel.textContent = 'Occupé';
        } else {
            toggleBtn.classList.remove('busy');
            statusLabel.textContent = 'Disponible';
        }
    }

    // --- Event Listeners ---

    toggleBtn.addEventListener('click', function () {
        isBusy = !isBusy;
        localStorage.setItem(STATUS_KEY, JSON.stringify(isBusy));
        updateToggleUI();

        showToast(isBusy ? 'Mode occupé activé' : 'Mode disponible activé');

        // Re-analyser si un message est présent
        if (smsInput.value.trim()) {
            var categories = analyzeMessage(smsInput.value);
            var suggestions = getSuggestions(categories);
            renderSuggestions(suggestions);
        }
    });

    analyzeBtn.addEventListener('click', function () {
        var text = smsInput.value.trim();
        if (!text) {
            showToast('Veuillez entrer un message');
            smsInput.focus();
            return;
        }

        var categories = analyzeMessage(text);
        var suggestions = getSuggestions(categories);
        renderSuggestions(suggestions);
    });

    // Analyser aussi avec Entrée
    smsInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeBtn.click();
        }
    });

    modalCancel.addEventListener('click', function () {
        addToHistory(smsInput.value.trim(), null, false);
        closeModal();
        showToast('Message ignoré');
    });

    modalCopy.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(selectedResponse).then(function () {
                addToHistory(smsInput.value.trim(), selectedResponse, true);
                closeModal();
                smsInput.value = '';
                suggestionsSection.style.display = 'none';
                showToast('Réponse copiée !');
            });
        } else {
            // Fallback pour les anciens navigateurs
            var textarea = document.createElement('textarea');
            textarea.value = selectedResponse;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            addToHistory(smsInput.value.trim(), selectedResponse, true);
            closeModal();
            smsInput.value = '';
            suggestionsSection.style.display = 'none';
            showToast('Réponse copiée !');
        }
    });

    modalSend.addEventListener('click', function (e) {
        var phone = phoneNumber.value.trim();
        if (!phone) {
            e.preventDefault();
            showToast('Entrez un numéro de téléphone');
            return;
        }
        addToHistory(smsInput.value.trim(), selectedResponse, true);
        closeModal();
        smsInput.value = '';
        suggestionsSection.style.display = 'none';
    });

    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    clearHistoryBtn.addEventListener('click', function () {
        if (getHistory().length === 0) {
            showToast('L\'historique est déjà vide');
            return;
        }
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
        showToast('Historique effacé');
    });

    // --- Initialisation ---
    updateToggleUI();
    renderHistory();

})();
