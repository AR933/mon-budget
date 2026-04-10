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

    // Génère des réponses contextuelles, naturelles et élaborées
    function generateResponses(intents, context) {
        var responses = [];
        var when = context.when || '';
        var activity = context.activity || '';
        var amount = context.amount || '';
        var time = context.time || '';
        var whenText = when ? ' ' + when : '';
        var whenCap = when ? when.charAt(0).toUpperCase() + when.slice(1) : '';

        for (var i = 0; i < intents.length; i++) {
            var intent = intents[i];

            if (intent === 'invitation') {
                if (isBusy) {
                    responses.push({ text: 'Ah c\'est vraiment dommage, j\'aurais adoré mais je suis pris(e)' + whenText + '. J\'ai pas mal de trucs en cours en ce moment. Mais on remet ça très vite, ça me ferait vraiment plaisir !', tag: 'Occupé - chaleureux', tagClass: 'tag-busy' });
                    responses.push({ text: 'Merci pour l\'invitation, c\'est super gentil ! Malheureusement je ne suis pas disponible' + whenText + ', j\'ai un emploi du temps un peu chargé ces temps-ci. On se replanifie ça dès que je me libère ?', tag: 'Occupé - poli', tagClass: 'tag-busy' });
                    responses.push({ text: 'Oh non, pas possible pour moi' + whenText + ', je suis déjà pris(e). C\'est frustrant parce que ça m\'aurait vraiment fait plaisir. Tu me recontactes la prochaine fois que tu organises quelque chose ?', tag: 'Occupé - expressif', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Carrément, ça me dit trop bien !' + (activity ? ' ' + activity.charAt(0).toUpperCase() + activity.slice(1) + ', c\'est une super idée.' : '') + (when ? ' ' + whenCap + ' ça me va parfaitement.' : ' Dis-moi quand ça t\'arrange, je m\'organise.') + ' Hâte d\'y être !', tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Avec grand plaisir !' + (activity ? ' Ça fait longtemps qu\'on n\'a pas fait ça ensemble, ' + activity + ' c\'est une excellente idée.' : ' Ça fait plaisir de se retrouver.') + (when ? ' ' + whenCap + ' c\'est parfait pour moi.' : '') + ' Tu as un endroit en tête ou on choisit ensemble ?', tag: 'Partant', tagClass: 'tag-casual' });
                    responses.push({ text: 'Pourquoi pas, c\'est tentant ! Faut que je vérifie mon planning' + (when ? ' pour ' + when : '') + ' mais a priori ça devrait le faire. Je te confirme dans la journée, mais garde-moi une place !', tag: 'Prudent', tagClass: 'tag-formal' });
                    responses.push({ text: 'Trop bien comme idée ! Je suis partant(e) à 100%.' + (when ? ' ' + whenCap + ', c\'est noté.' : '') + ' Dis-moi juste l\'heure et le lieu et je serai là. On est combien au total ?', tag: 'Motivé', tagClass: 'tag-casual' });
                }
            }

            if (intent === 'logistics') {
                if (isBusy) {
                    responses.push({ text: 'Je suis en plein truc là, je regarde mon planning dès que j\'ai une minute et je te confirme le créneau qui m\'arrange. Désolé(e) pour l\'attente !', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    if (time) {
                        responses.push({ text: 'OK ' + time + ', ça me convient parfaitement ! Je serai là à l\'heure. On se retrouve où exactement ? Envoie-moi l\'adresse si tu peux.', tag: 'Confirme', tagClass: 'tag-casual' });
                        responses.push({ text: time + ' c\'est nickel pour moi, je bloque le créneau. Tu veux qu\'on se retrouve directement sur place ou on fait le trajet ensemble ?', tag: 'Organisé', tagClass: 'tag-formal' });
                    } else {
                        responses.push({ text: 'Moi je suis assez flexible niveau horaires, donc propose-moi ce qui t\'arrange le mieux et je m\'adapterai. En fin de journée ou plutôt en soirée, les deux me vont.', tag: 'Souple', tagClass: 'tag-casual' });
                        responses.push({ text: 'Je te laisse choisir le créneau qui te convient, ça m\'ira. Essaie juste de me prévenir un peu à l\'avance que je puisse m\'organiser de mon côté.', tag: 'Arrangeant', tagClass: 'tag-formal' });
                    }
                }
            }

            if (intent === 'favor') {
                if (isBusy) {
                    responses.push({ text: 'Je voudrais vraiment t\'aider mais je suis un peu sous l\'eau en ce moment. Est-ce que ça peut attendre un peu ? Je m\'en occupe dès que je me libère, promis !', tag: 'Occupé - bienveillant', tagClass: 'tag-busy' });
                    responses.push({ text: 'Ah, je suis pas dispo tout de suite malheureusement. Mais je n\'oublie pas, note-le moi et je te reviens là-dessus dès que possible. C\'est urgent ou ça peut attendre un peu ?', tag: 'Occupé - attentionné', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Bien sûr, avec plaisir ! Dis-moi exactement ce qu\'il te faut et comment je peux t\'aider au mieux. N\'hésite pas à me donner tous les détails, comme ça je fais les choses bien.', tag: 'Serviable', tagClass: 'tag-formal' });
                    responses.push({ text: 'Oui pas de souci, je suis là pour ça ! Explique-moi ce que tu as besoin exactement et je vois ce que je peux faire. C\'est pour quand idéalement ?', tag: 'Décontracté', tagClass: 'tag-casual' });
                    responses.push({ text: 'Ça dépend un peu de ce que c\'est, mais a priori oui ! Explique-moi la situation en détail et je te dis si je peux t\'aider et comment on s\'organise.', tag: 'Prudent', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'urgent') {
                if (isBusy) {
                    responses.push({ text: 'J\'ai bien vu ton message et je comprends que c\'est urgent. Je suis en plein truc mais je fais mon maximum pour m\'en occuper le plus rapidement possible. Je te tiens au courant dès que j\'avance.', tag: 'Occupé - prioritaire', tagClass: 'tag-busy' });
                    responses.push({ text: 'C\'est noté, j\'ai compris l\'urgence. Je ne peux pas tout lâcher là tout de suite mais c\'est en haut de ma liste de priorités. Je reviens vers toi dans les plus brefs délais.', tag: 'Occupé - honnête', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'OK j\'ai vu ton message, je m\'en occupe immédiatement. Ne t\'inquiète pas, je te tiens au courant de l\'avancement dès que j\'ai du nouveau. On va régler ça.', tag: 'Réactif', tagClass: 'tag-casual' });
                    responses.push({ text: 'Je suis dessus tout de suite. Je comprends que c\'est important et je fais le nécessaire. Je te recontacte dès que c\'est réglé ou si j\'ai besoin d\'infos complémentaires.', tag: 'Pro', tagClass: 'tag-formal' });
                    responses.push({ text: 'Reçu 5 sur 5 ! T\'inquiète pas, je gère ça en priorité. Je te fais un retour très rapidement. Si entre-temps tu as d\'autres infos, n\'hésite pas à m\'envoyer.', tag: 'Rassurant', tagClass: 'tag-casual' });
                }
            }

            if (intent === 'howAreYou') {
                if (isBusy) {
                    responses.push({ text: 'Ça va bien merci, mais je suis pas mal occupé(e) en ce moment ! J\'ai beaucoup de choses en cours. Je te rappelle ou je t\'écris dès que je souffle un peu, on pourra discuter tranquillement.', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'La forme, merci de prendre des nouvelles ! Par contre je suis un peu speed là, je peux pas trop discuter. On se reparle très vite, j\'ai plein de trucs à te raconter !', tag: 'Occupé - amical', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Ça va super bien, merci de demander ! Et toi, comment tu vas ? Ça fait un moment qu\'on ne s\'est pas parlé, raconte-moi un peu ce que tu deviens, quoi de neuf dans ta vie ?', tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Tranquille, tout roule de mon côté ! Et toi alors, la forme ? J\'espère que tout va bien pour toi. On devrait se voir un de ces jours pour se raconter tout ça autour d\'un café.', tag: 'Décontracté', tagClass: 'tag-casual' });
                    responses.push({ text: 'Très bien merci, c\'est gentil ! Je suis vraiment content(e) d\'avoir de tes nouvelles. De mon côté tout se passe bien. Et toi, quoi de beau ? Comment va la famille ?', tag: 'Chaleureux', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'thanks') {
                if (isBusy) {
                    responses.push({ text: 'Mais de rien, c\'est tout à fait normal ! Ça m\'a fait plaisir de pouvoir t\'aider. Si tu as besoin d\'autre chose n\'hésite surtout pas.', tag: 'Occupé - gentil', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Avec plaisir, vraiment ! C\'est tout à fait normal, je suis content(e) d\'avoir pu t\'aider. N\'hésite surtout pas si tu as besoin de quoi que ce soit d\'autre, je suis là.', tag: 'Généreux', tagClass: 'tag-casual' });
                    responses.push({ text: 'De rien du tout, c\'est bien normal ! Ça me fait toujours plaisir de rendre service. Tu sais que tu peux compter sur moi quand tu veux.', tag: 'Chaleureux', tagClass: 'tag-formal' });
                    responses.push({ text: 'Pas de quoi, ça m\'a fait plaisir ! C\'est toujours un plaisir de donner un coup de main. La prochaine fois que t\'as besoin, fais-moi signe sans hésiter.', tag: 'Amical', tagClass: 'tag-casual' });
                }
            }

            if (intent === 'confirmation') {
                if (isBusy) {
                    responses.push({ text: 'Parfait, c\'est bien noté de mon côté ! Merci pour la confirmation, ça me rassure. On se tient au courant si jamais il y a un changement.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Super, c\'est parfait alors ! C\'est noté de mon côté.' + (when ? ' Vivement ' + when + ', ça va être chouette !' : ' J\'ai hâte, à très vite !'), tag: 'Enthousiaste', tagClass: 'tag-casual' });
                    responses.push({ text: 'Top, merci pour la confirmation ! Ça fait plaisir que ça se mette en place. On se retrouve comme prévu' + (when ? ' ' + when : '') + ', j\'ai vraiment hâte d\'y être.', tag: 'Content', tagClass: 'tag-casual' });
                    responses.push({ text: 'Excellent, c\'est validé alors ! Je mets ça dans mon agenda. Si jamais il y a le moindre changement, n\'hésite pas à me prévenir. À ' + (when || 'bientôt') + ' !', tag: 'Organisé', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'apology') {
                if (isBusy) {
                    responses.push({ text: 'T\'inquiète pas du tout, c\'est vraiment pas grave. Ça arrive à tout le monde, y a pas de souci. On en reparle plus tard tranquillement si besoin.', tag: 'Occupé - compréhensif', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Mais non, t\'en fais pas du tout ! Ça arrive à tout le monde, c\'est vraiment pas un problème. L\'important c\'est que tout aille bien de ton côté. On décale quand ça t\'arrange, y a aucune urgence.', tag: 'Compréhensif', tagClass: 'tag-casual' });
                    responses.push({ text: 'Aucun souci, je comprends parfaitement ! C\'est la vie, ça arrive. Ne te prends pas la tête avec ça, c\'est pas du tout grave. On se replanifie ça tranquillement quand tu veux.', tag: 'Rassurant', tagClass: 'tag-casual' });
                    responses.push({ text: 'C\'est vraiment rien, ne t\'inquiète surtout pas pour ça. Je sais que c\'est pas de ta faute et ça ne change rien entre nous. Prends le temps qu\'il te faut et on se recale dès que tu es dispo.', tag: 'Bienveillant', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'money') {
                if (isBusy) {
                    responses.push({ text: 'C\'est bien noté, je regarde ça dès que je suis un peu plus disponible. Je te fais le retour dans la journée, ne t\'inquiète pas je n\'oublie pas.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    if (amount) {
                        responses.push({ text: 'Pas de souci pour les ' + amount + ', c\'est tout à fait normal. Je te fais le virement aujourd\'hui. Tu préfères par Lydia, par virement bancaire ou autre chose ? Dis-moi ce qui est le plus simple pour toi.', tag: 'Proactif', tagClass: 'tag-casual' });
                        responses.push({ text: 'C\'est noté, ' + amount + '. Je m\'en occupe rapidement, tu n\'auras pas à attendre. Envoie-moi tes coordonnées bancaires ou ton Lydia et je te fais le transfert dans la foulée.', tag: 'Efficace', tagClass: 'tag-formal' });
                    } else {
                        responses.push({ text: 'Pas de problème du tout, on va régler ça. Tu peux me rappeler le montant exact et comment tu préfères qu\'on fasse ? Virement, Lydia, espèces ? Je m\'adapte à ce qui t\'arrange le mieux.', tag: 'Arrangeant', tagClass: 'tag-casual' });
                        responses.push({ text: 'Bien sûr, c\'est tout à fait normal. Dis-moi combien c\'est exactement et de quelle manière tu voudrais que je te règle, comme ça on est quittes rapidement et proprement.', tag: 'Direct', tagClass: 'tag-formal' });
                    }
                }
            }

            if (intent === 'greeting') {
                if (isBusy) {
                    responses.push({ text: 'Salut ! Ça me fait plaisir d\'avoir de tes nouvelles ! Par contre je suis un peu pris(e) là, je te recontacte dès que j\'ai un moment pour qu\'on puisse discuter tranquillement.', tag: 'Occupé', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Salut ! Ça fait super plaisir d\'avoir de tes nouvelles ! Comment tu vas ? Ça fait un petit moment, raconte-moi un peu ce que tu deviens !', tag: 'Chaleureux', tagClass: 'tag-casual' });
                    responses.push({ text: 'Hey, coucou ! Trop contente(e) de te lire ! Comment ça va de ton côté ? J\'espère que tout se passe bien pour toi. Quoi de neuf ?', tag: 'Amical', tagClass: 'tag-casual' });
                    responses.push({ text: 'Bonjour ! Quel plaisir d\'avoir de tes nouvelles, ça faisait longtemps ! J\'espère que tu vas bien et que tout roule pour toi. Comment va la vie ?', tag: 'Poli', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'question') {
                if (isBusy) {
                    responses.push({ text: 'C\'est une bonne question ! Je suis un peu pris(e) là mais je prends le temps de te répondre correctement dès que j\'ai 5 minutes. Je ne veux pas te répondre à la va-vite.', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'Je vois ta question et je veux te faire une réponse complète. Laisse-moi un petit moment, je reviens vers toi avec tous les détails dès que je me libère.', tag: 'Occupé - attentionné', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'Très bonne question ! Laisse-moi vérifier ça de mon côté et je te fais un retour complet. Je veux être sûr(e) de te donner la bonne info. Je te dis ça très vite.', tag: 'Réfléchi', tagClass: 'tag-formal' });
                    responses.push({ text: 'Oui bien sûr ! Je peux t\'expliquer ça en détail si tu veux. C\'est un sujet que je connais plutôt bien. Tu préfères qu\'on en parle par message ou de vive voix ?', tag: 'Affirmatif', tagClass: 'tag-casual' });
                    responses.push({ text: 'Hmm, bonne question, je suis pas totalement sûr(e) de la réponse là comme ça. Laisse-moi me renseigner un peu et je te reviens avec une réponse fiable plutôt que de te dire une bêtise.', tag: 'Honnête', tagClass: 'tag-formal' });
                }
            }

            if (intent === 'generic') {
                if (isBusy) {
                    responses.push({ text: 'Merci pour ton message, c\'est bien reçu ! Je suis un peu occupé(e) en ce moment mais je te réponds plus en détail dès que je me libère. Promis je ne t\'oublie pas !', tag: 'Occupé', tagClass: 'tag-busy' });
                    responses.push({ text: 'Bien noté, merci de m\'avoir prévenu(e) ! Je suis un peu sous l\'eau là mais je reviens vers toi dès que possible pour en discuter plus tranquillement.', tag: 'Occupé - attentionné', tagClass: 'tag-busy' });
                } else {
                    responses.push({ text: 'D\'accord, merci de m\'en informer ! C\'est bien noté de mon côté. N\'hésite pas à me tenir au courant si jamais il y a du nouveau ou si tu as besoin de quoi que ce soit.', tag: 'Poli', tagClass: 'tag-formal' });
                    responses.push({ text: 'Bien reçu, merci pour l\'info ! Je prends note. Si tu as besoin d\'en reparler ou si tu veux qu\'on en discute plus en détail, fais-moi signe, je suis disponible.', tag: 'Attentionné', tagClass: 'tag-casual' });
                    responses.push({ text: 'OK, c\'est noté ! Merci de me prévenir, j\'apprécie. Tiens-moi au courant de la suite et n\'hésite vraiment pas si je peux faire quoi que ce soit pour aider.', tag: 'Décontracté', tagClass: 'tag-casual' });
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
