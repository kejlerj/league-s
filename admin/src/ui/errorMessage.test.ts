import { ApiError } from '@/api/client'
import { errorMessage } from '@/ui/errorMessage'

test.each([
  [new ApiError(0, 'x'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(503, 'x'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(403, 'x'), undefined, 'Accès refusé.'],
  [new ApiError(429, 'x'), undefined, 'Trop de tentatives. Réessayez dans une minute.'],
  [new ApiError(409, 'déjà pris'), undefined, 'déjà pris'],
  [new ApiError(409, 'x'), { 409: 'Conflit.' }, 'Conflit.'],
  [new ApiError(403, 'x'), { 403: 'Mot de passe actuel incorrect.' }, 'Mot de passe actuel incorrect.'],
  [
    new ApiError(422, 'x', { name: 'required', logo: 'http_url' }),
    { 422: 'Autre.' },
    'Champs invalides : name (obligatoire), logo (URL http ou https attendue)',
  ],
  [new ApiError(422, 'x', { a: 'email', b: 'min', c: 'max', d: 'oneof' }), undefined,
    'Champs invalides : a (e-mail invalide), b (trop petit), c (trop grand), d (invalide)'],
  [new Error('boom'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(405, 'HTTP 405'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(404, 'HTTP 404'), { 404: 'Introuvable.' }, 'Introuvable.'],
])('errorMessage %#', (err, overrides, expected) => {
  expect(errorMessage(err, overrides)).toBe(expected)
})
