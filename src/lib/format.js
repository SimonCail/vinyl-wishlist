const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

export const formatPrice = (n) => (n == null ? null : euro.format(n))