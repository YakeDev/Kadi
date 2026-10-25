# Versements partiels

Une facture émise reçoit plusieurs versements dans sa propre devise (USD ou CDF). La liste affiche le total, le cumul reçu et le solde. Ouvrir **Versements**, renseigner le montant reçu, la date de réception, le mode et, si nécessaire, une référence. La saisie est manuelle et concerne un paiement déjà reçu.

Le statut passe automatiquement à **Partiellement payée**, puis à **Payée** lorsque le cumul atteint le total. Un solde partiel peut aussi être en retard ; il reste présent dans les relances et le filtre des retards. Les versements ne modifient pas le contenu archivé de la facture. Son PDF ajoute une situation de règlement datée, avec le reçu cumulé et le reste à payer.

L'annulation d'une saisie demande un motif, conserve la ligne dans l'historique et recalcule le solde et le statut. Cette opération sert à corriger une erreur de saisie. Les versements ne sont ni éditables ni supprimables.

## Calculs et protections

- Montants positifs avec deux décimales maximum ; cumul plafonné au total de la facture.
- Reçus dans la devise de la facture uniquement ; aucune conversion automatique.
- Date civile de réception au plus tard aujourd'hui, selon Africa/Lubumbashi. Un acompte reçu avant l'émission peut être saisi après émission avec sa vraie date de réception.
- Chaque enregistrement porte une clé d'idempotence : le renvoi du même formulaire ne crée pas un second versement. Une clé réutilisée avec un autre contenu est refusée.
- Les opérations PostgreSQL verrouillent la facture, écrivent le journal et recalculent le cumul/statut dans la même transaction. Les opérations concurrentes sur le même solde sont sérialisées.
- Le navigateur peut seulement lire les versements de son entreprise. Les écritures passent par l'API authentifiée et les fonctions `SECURITY INVOKER`, réservées à `service_role`. Les fonctions vérifient aussi l'appartenance de l'auteur à l'entreprise et la facture ciblée.
- Le serveur calcule `balance_due` en centimes. `paid_amount` ne peut être modifié que par les déclencheurs du journal.

## Statistiques

Les revenus et la courbe d'encaissement utilisent les versements non annulés dont la **date de réception** est dans la période choisie, y compris lorsque la facture a été émise auparavant. Les factures, clients et prestations facturés restent sélectionnés par **date d'émission**. Le montant en attente est le solde actuel des factures émises sur cette période. Le délai de règlement est calculé pour les factures entièrement soldées.

## Migration et historique existant

Après sauvegarde, appliquer `20261024234736_partial_payments.sql` d'abord sur staging, vérifier les contrôles ci-dessous, puis sur la base cible avant le serveur. La migration est transactionnelle. Ne pas rejouer le schéma initial sur une base existante.

Les factures déjà marquées payées conservent leurs totaux et leur taxe. Un versement **Ancien statut payé**, explicitement marqué `is_legacy`, reprend le solde déclaré. Il ne reconstitue pas des acomptes inconnus. La date est celle de `paid_at` quand elle existe ; sinon celle de la facture et la référence précise qu'elle est estimée. Une facture payée à zéro n'engendre aucun versement artificiel.

Pendant le déploiement, les anciens clients qui déclarent une facture payée déclenchent un versement de son solde restant. L'interface actuelle dirige la saisie vers le panneau Versements. Les archives PDF historiques non fiables restent signalées comme indisponibles.

Contrôles après migration :

```sql
-- Aucun écart entre journal actif et cumul, aucune devise mélangée.
select i.id
from public.invoices i
left join public.invoice_payments p on p.invoice_id = i.id and p.tenant_id = i.tenant_id
group by i.id
having i.paid_amount <> coalesce(sum(p.amount) filter (where p.voided_at is null), 0)
   or bool_or(p.currency <> i.currency);

-- RLS activée ; écritures et RPC refusées aux rôles navigateur.
select relrowsecurity from pg_class where oid = 'public.invoice_payments'::regclass;
select has_table_privilege('authenticated', 'public.invoice_payments', 'insert,update,delete') as browser_can_write;
```

Les premiers contrôles doivent renvoyer zéro écart, RLS vraie et écriture navigateur fausse. Vérifier aussi les refus pour le rôle `anon`, les fonctions réservées au serveur et le maintien des montants et archives historiques. Tester 350 = 150 + 123 + 77, la répétition d'une même requête, le dépassement du solde, une annulation, la devise CDF et les deux entreprises.

## API

- `GET /api/invoices/:id/payments` : historique paginé, incluant les annulations.
- `POST /api/invoices/:id/payments` : `idempotency_key` UUID, `amount`, `paid_on` au format `YYYY-MM-DD`, `method` (`cash`, `bank_transfer`, `mobile_money`, `other`), `reference` facultative.
- `POST /api/invoices/:id/payments/:paymentId/void` : `reason` de 3 à 500 caractères.

Les réponses de facture incluent `paid_amount`, `balance_due` et `is_overdue`. Le statut partiel est dérivé du journal et ne se saisit pas manuellement. Les écritures échouent sans modifier le cumul si la facture, l'entreprise, le montant ou la clé ne respecte pas les règles.
