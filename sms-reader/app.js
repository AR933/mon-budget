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
    var micBtn = document.getElementById('micBtn');

    // =========================================================================
    // RECONNAISSANCE VOCALE
    // =========================================================================

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recognition = null;
    var isRecording = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = function () {
            isRecording = true;
            micBtn.classList.add('recording');
            showToast('Parlez maintenant...');
        };

        recognition.onresult = function (event) {
            var transcript = '';
            for (var i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            smsInput.value = transcript;

            // Si résultat final, lancer l'analyse automatiquement
            if (event.results[event.results.length - 1].isFinal) {
                setTimeout(function () {
                    analyzeBtn.click();
                }, 400);
            }
        };

        recognition.onerror = function (event) {
            isRecording = false;
            micBtn.classList.remove('recording');
            if (event.error === 'not-allowed') {
                showToast('Autorisez le micro dans les paramètres');
            } else if (event.error === 'no-speech') {
                showToast('Aucune voix détectée, réessayez');
            } else {
                showToast('Erreur micro : ' + event.error);
            }
        };

        recognition.onend = function () {
            isRecording = false;
            micBtn.classList.remove('recording');
        };
    } else {
        // Navigateur non supporté : cacher le bouton micro
        micBtn.style.display = 'none';
    }

    micBtn.addEventListener('click', function () {
        if (!recognition) {
            showToast('La reconnaissance vocale n\'est pas supportée');
            return;
        }
        if (isRecording) {
            recognition.stop();
        } else {
            smsInput.value = '';
            recognition.start();
        }
    });

    // =========================================================================
    // MOTEUR D'ANALYSE INTELLIGENT
    // =========================================================================

    // Détecte les intentions dans le message (plusieurs possibles)
    function detectIntents(text) {
        var lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var original = text.toLowerCase();
        var intents = [];

        // --- Question sur la disponibilité / Invitation ---
        if (/\b(dispo(nible)?|libre|occupe|tu (peux|pourrais)|ca te (dit|tente)|tu (veux|voudrais|viendrais|viendras)|on se (voit|retrouve|rejoint)|viens?)\b/.test(lower) ||
            /\b(sortir|diner|manger|boire un (verre|coup)|apero|resto|bar|cine(ma)?|soiree|fete)\b/.test(lower)) {
            intents.push('invitation');
        }

        // --- Demande d'heure / lieu / RDV ---
        if (/\b(a quelle heure|quel(le)? heure|ou (on|ca)|quel endroit|on se retrouve ou|rdv|rendez.?vous)\b/.test(lower) ||
            /\b(quand est.ce|c'?est quand|a quand|pour quand)\b/.test(lower)) {
            intents.push('logistics');
        }

        // --- Demande de service / faveur ---
        if (/\b(tu (peux|pourrais) me|peux.tu|pourrais.tu|j'?aurais besoin|tu me|rendre (un )?service|coup de main|aider|aide.moi)\b/.test(lower) ||
            /\b(preter|emprunter|envoyer|ramener|deposer|recuperer|chercher|acheter|passer me)\b/.test(lower)) {
            intents.push('favor');
        }

        // --- Urgence ---
        if (/\b(urgent|urgence|vite|rapidement|asap|immediatement|tout de suite|appelle.moi|rappelle.moi|le plus (tot|vite))\b/.test(lower) ||
            /!{2,}/.test(text) ||
            /\b(tres important|c'?est important|important)\b/.test(lower)) {
            intents.push('urgent');
        }

        // --- Nouvelles / Comment ça va ---
        if (/\b((comment )?((ca|tu) va(s)?)|la forme|quoi de (neuf|beau|bon)|comment (tu )?vas.tu)\b/.test(lower) ||
            /\b(t'?es? ou|tu fais quoi|tu (es|fais) quoi)\b/.test(lower)) {
            intents.push('howAreYou');
        }

        // --- Remerciement ---
        if (/\b(merci|remercie|merci (beaucoup|bcp|infiniment|mille fois))\b/.test(lower)) {
            intents.push('thanks');
        }

        // --- Confirmation / Accord ---
        if (/^(ok|oui|d'?accord|entendu|ca marche|c'?est (note|bon|parfait)|compris|top|parfait|nickel|super|genial|cool|bien recu|valide|confirme|yep|yes|ouais|carrément|grave)[\s!.]*$/i.test(lower.trim())) {
            intents.push('confirmation');
        }

        // --- Excuse / Annulation ---
        if (/\b(desole|pardon|excuse|navre|je (peux|pourrai) (pas|plus)|annul|reporter|remettre|decaler|empeche|retard|en retard)\b/.test(lower)) {
            intents.push('apology');
        }

        // --- Argent ---
        if (/\b(argent|euros?|€|\d+\s*€|payer|rembourser|dette|virement|transfert|combien (je |tu )?te dois|tu me dois|prix|cout|paypal|lydia|revolut)\b/.test(lower)) {
            intents.push('money');
        }

        // --- Salutation simple ---
        if (/^(salut|bonjour|bonsoir|coucou|hello|hey|yo|wesh|slt|bjr|cc|re)[\s!.,]*$/i.test(lower.trim()) ||
            /^(salut|bonjour|bonsoir|coucou|hello|hey|yo|cc)[\s!,]/.test(lower.trim())) {
            intents.push('greeting');
        }

        // --- Question générale (contient ?) ---
        if (original.indexOf('?') !== -1 && intents.length === 0) {
            intents.push('question');
        }

        // --- Rien détecté ---
        if (intents.length === 0) {
            intents.push('generic');
        }

        return intents;
    }

    // Extrait des infos contextuelles du message
    function extractContext(text) {
        var lower = text.toLowerCase();
        var ctx = {};

        // Moment mentionné
        if (/\b(ce soir|tonight)\b/i.test(lower)) ctx.when = 'ce soir';
        else if (/\b(demain)\b/i.test(lower)) ctx.when = 'demain';
        else if (/\b(ce week.?end|ce we)\b/i.test(lower)) ctx.when = 'ce week-end';
        else if (/\b(samedi)\b/i.test(lower)) ctx.when = 'samedi';
        else if (/\b(dimanche)\b/i.test(lower)) ctx.when = 'dimanche';
        else if (/\b(lundi)\b/i.test(lower)) ctx.when = 'lundi';
        else if (/\b(mardi)\b/i.test(lower)) ctx.when = 'mardi';
        else if (/\b(mercredi)\b/i.test(lower)) ctx.when = 'mercredi';
        else if (/\b(jeudi)\b/i.test(lower)) ctx.when = 'jeudi';
        else if (/\b(vendredi)\b/i.test(lower)) ctx.when = 'vendredi';
        else if (/\b(aujourd'?hui|auj)\b/i.test(lower)) ctx.when = "aujourd'hui";
        else if (/\b(maintenant|la tout de suite)\b/i.test(lower)) ctx.when = 'maintenant';

        // Activité mentionnée
        if (/\b(diner|manger|resto|restaurant)\b/i.test(lower)) ctx.activity = 'manger';
        else if (/\b(boire|verre|coup|apero|bar)\b/i.test(lower)) ctx.activity = 'boire un verre';
        else if (/\b(cine(ma)?|film)\b/i.test(lower)) ctx.activity = 'ciné';
        else if (/\b(soiree|fete|sortir)\b/i.test(lower)) ctx.activity = 'sortir';
        else if (/\b(sport|foot|match|courir|run|salle)\b/i.test(lower)) ctx.activity = 'sport';
        else if (/\b(bosser|travailler|projet|boulot)\b/i.test(lower)) ctx.activity = 'bosser';

        // Montant mentionné
        var moneyMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)/);
        if (moneyMatch) ctx.amount = moneyMatch[1] + ' €';

        // Heure mentionnée
        var timeMatch = lower.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/);
        if (timeMatch) ctx.time = timeMatch[1] + 'h' + (timeMatch[2] || '');

        return ctx;
    }

    // Génère des réponses contextuelles et naturelles
    function generateResponses(intents, context) {
        var responses = [];
        var when = context.when || '';
        var activity = context.activity || '';
        var amount = context.amount || '';
        var time = context.time || '';

        for (var i = 0; i < intents.length; i++) {
            var intent = intents[i];

            if (intent === 'invitation') {
                if (isBusy) {
                    responses.push({ text: 'Ah dommage, je suis pris(e)' + (when ? ' ' + when : '') + '. On remet ça ?', tag: 'Occupé - décline', tagClass: 'tag-busy' });
                    responses.push({ text: 'J\'aurais bien aimé mais je ne suis pas dispo' + (when ? ' ' + when : '') + '. La prochaine fois !', tag: 'Occupé - poli', tagClass: 'tag-busy' });
                    responses.push({ text: 'Pas possible pour moi, désolé(e) ! Tu me redis quand tu refais ça.', tag: 'Occupé - court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Carrément, ça me dit bien !' + (when ? ' ' + when.charAt(0).toUpperCase() + when.slice(1) + ' ça me va.' : ' Dis-moi quand.'), tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Avec plaisir !' + (activity ? ' ' + activity.charAt(0).toUpperCase() + activity.slice(1) + ', bonne idée.' : '') + (when ? ' ' + when.charAt(0).toUpperCase() + when.slice(1) + ' c\'est parfait.' : ' Tu proposes quand ?'), tag: 'Partant', tagClass: 'tag-casual' });
                    responses.push({ text: 'Pourquoi pas ! Faut que je vérifie' + (when ? ' pour ' + when : '') + ' mais a priori c\'est bon.', tag: 'Prudent', tagClass: 'tag-formal' });
                    responses.push({ text: 'Bonne idée ! C\'est où et à quelle heure ?', tag: 'Direct', tagClass: 'tag-short' });
                }
            }

            if (intent === 'logistics') {
                if (isBusy) {
                    responses.push({ text: 'Je regarde et je te confirme dès que je suis dispo.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    if (time) {
                        responses.push({ text: 'OK pour ' + time + ', ça me va !', tag: 'Confirme', tagClass: 'tag-short' });
                        responses.push({ text: time + ' c\'est parfait pour moi. On se retrouve où ?', tag: 'Confirme + question', tagClass: 'tag-casual' });
                    } else {
                        responses.push({ text: 'Moi je suis flexible, dis-moi ce qui t\'arrange.', tag: 'Souple', tagClass: 'tag-casual' });
                        responses.push({ text: 'Je te laisse choisir, ça m\'ira.', tag: 'Court', tagClass: 'tag-short' });
                    }
                }
            }

            if (intent === 'favor') {
                if (isBusy) {
                    responses.push({ text: 'Je suis un peu débordé(e) là, je peux regarder ça plus tard ?', tag: 'Occupé - reporte', tagClass: 'tag-busy' });
                    responses.push({ text: 'Pas dispo tout de suite mais je n\'oublie pas, je te reviens là-dessus.', tag: 'Occupé - promesse', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Bien sûr, dis-moi exactement ce qu\'il te faut.', tag: 'Serviable', tagClass: 'tag-formal' });
                    responses.push({ text: 'Oui pas de souci ! C\'est quoi exactement ?', tag: 'Décontracté', tagClass: 'tag-casual' });
                    responses.push({ text: 'Ça dépend de quoi il s\'agit, explique-moi ?', tag: 'Prudent', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'urgent') {
                if (isBusy) {
                    responses.push({ text: 'J\'ai vu, je fais au plus vite même si je suis en plein truc.', tag: 'Occupé - prioritaire', tagClass: 'tag-busy' });
                    responses.push({ text: 'C\'est noté. Je ne peux pas là tout de suite mais je m\'en occupe dès que possible.', tag: 'Occupé - honnête', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'OK j\'ai vu, je m\'en occupe tout de suite.', tag: 'Réactif', tagClass: 'tag-short' });
                    responses.push({ text: 'Je suis dessus. Je te tiens au courant.', tag: 'Pro', tagClass: 'tag-formal' });
                    responses.push({ text: 'Reçu ! T\'inquiète, je gère.', tag: 'Rassurant', tagClass: 'tag-casual' });
                }
            }

            if (intent === 'howAreYou') {
                if (isBusy) {
                    responses.push({ text: 'Ça va mais bien occupé(e) ! Je te rappelle quand je souffle un peu.', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'La forme mais speed ! On se reparle vite.', tag: 'Occupé - court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Ça va super, et toi ? Quoi de neuf ?', tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Tranquille ! Et toi, tout roule ?', tag: 'Décontracté', tagClass: 'tag-casual' });
                    responses.push({ text: 'Très bien merci ! Content(e) d\'avoir de tes nouvelles.', tag: 'Chaleureux', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'thanks') {
                if (isBusy) {
                    responses.push({ text: 'De rien !', tag: 'Court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Avec plaisir ! N\'hésite pas si t\'as besoin.', tag: 'Généreux', tagClass: 'tag-casual' });
                    responses.push({ text: 'De rien, c\'est normal !', tag: 'Simple', tagClass: 'tag-short' });
                    responses.push({ text: 'Pas de quoi, ça m\'a fait plaisir.', tag: 'Chaleureux', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'confirmation') {
                if (isBusy) {
                    responses.push({ text: '👍', tag: 'Emoji', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Parfait, c\'est noté !', tag: 'Court', tagClass: 'tag-short' });
                    responses.push({ text: 'Top, à ' + (when || 'bientôt') + ' alors !', tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Super, hâte d\'y être !', tag: 'Content', tagClass: 'tag-casual' });
                }
            }

            if (intent === 'apology') {
                if (isBusy) {
                    responses.push({ text: 'T\'inquiète, c\'est pas grave.', tag: 'Court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Pas de souci, ça arrive ! On décale quand tu veux.', tag: 'Compréhensif', tagClass: 'tag-casual' });
                    responses.push({ text: 'Aucun problème, t\'en fais pas.', tag: 'Rassurant', tagClass: 'tag-short' });
                    responses.push({ text: 'C\'est rien du tout, t\'inquiète pas pour ça.', tag: 'Bienveillant', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'money') {
                if (isBusy) {
                    responses.push({ text: 'Noté, je regarde ça dès que je peux.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    if (amount) {
                        responses.push({ text: 'OK pour les ' + amount + ', je te fais le virement.', tag: 'Action', tagClass: 'tag-short' });
                        responses.push({ text: 'C\'est noté, ' + amount + '. Je m\'en occupe.', tag: 'Confirmé', tagClass: 'tag-formal' });
                    } else {
                        responses.push({ text: 'Pas de problème, on règle ça. Tu veux que je te fasse un virement ?', tag: 'Proactif', tagClass: 'tag-casual' });
                        responses.push({ text: 'C\'est combien exactement ? Je te fais ça rapidement.', tag: 'Direct', tagClass: 'tag-short' });
                    }
                }
            }

            if (intent === 'greeting') {
                if (isBusy) {
                    responses.push({ text: 'Salut ! Je suis un peu pris(e) là, je te reparle vite.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Salut ! Ça fait plaisir, comment tu vas ?', tag: 'Chaleureux', tagClass: 'tag-casual' });
                    responses.push({ text: 'Hey ! Quoi de beau ?', tag: 'Décontracté', tagClass: 'tag-casual' });
                    responses.push({ text: 'Coucou ! Tout va bien ?', tag: 'Amical', tagClass: 'tag-short' });
                }
            }

            if (intent === 'question') {
                if (isBusy) {
                    responses.push({ text: 'Bonne question ! Je te réponds dès que j\'ai 5 minutes.', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'Je regarde ça et je reviens vers toi.', tag: 'Occupé - court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Bonne question, laisse-moi vérifier et je te dis.', tag: 'Réfléchi', tagClass: 'tag-formal' });
                    responses.push({ text: 'Oui ! Tu veux que je t\'explique en détail ?', tag: 'Affirmatif', tagClass: 'tag-casual' });
                    responses.push({ text: 'Hmm je suis pas sûr(e), je me renseigne.', tag: 'Honnête', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'generic') {
                if (isBusy) {
                    responses.push({ text: 'Bien reçu ! Je suis un peu occupé(e), je te réponds mieux tout à l\'heure.', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'OK noté, je reviens vers toi dès que je peux.', tag: 'Occupé - court', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'D\'accord, je note !', tag: 'Court', tagClass: 'tag-short' });
                    responses.push({ text: 'Bien reçu, merci de me prévenir.', tag: 'Poli', tagClass: 'tag-formal' });
                    responses.push({ text: 'OK, tiens-moi au courant !', tag: 'Décontracté', tagClass: 'tag-casual' });
                }
            }
        }

        // Dédupliquer et limiter à 5
        var seen = {};
        var unique = [];
        for (var j = 0; j < responses.length && unique.length < 5; j++) {
            if (!seen[responses[j].text]) {
                seen[responses[j].text] = true;
                unique.push(responses[j]);
            }
        }

        return unique;
    }

    // =========================================================================
    // INTERFACE
    // =========================================================================

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
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Affichage des suggestions ---

    function renderSuggestions(suggestions) {
        suggestionsList.innerHTML = '';

        for (var i = 0; i < suggestions.length; i++) {
            (function (suggestion) {
                var card = document.createElement('div');
                card.className = 'suggestion-card' + (isBusy ? ' busy-response' : '');
                card.innerHTML =
                    '<span class="suggestion-tag ' + suggestion.tagClass + '">' + escapeHtml(suggestion.tag) + '</span>' +
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
            var intents = detectIntents(smsInput.value);
            var context = extractContext(smsInput.value);
            var suggestions = generateResponses(intents, context);
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

        var intents = detectIntents(text);
        var context = extractContext(text);
        var suggestions = generateResponses(intents, context);
        renderSuggestions(suggestions);
    });

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
