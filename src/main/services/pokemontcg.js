const axios = require('axios')

const BASE = 'https://api.tcgdex.net/v2/en'

async function searchCards(query) {
  const params = { 'pagination:itemsPerPage': 30, 'sort:field': 'releaseDate', 'sort:order': 'DESC' }
  if (/^\d+\/\d+$/.test(query)) {
    params['eq:localId'] = query.split('/')[0]
  } else {
    params.name = query
  }
  const res = await axios.get(`${BASE}/cards`, { params, timeout: 15000 })
  return res.data || []
}

async function getCard(id) {
  const res = await axios.get(`${BASE}/cards/${id}`, { timeout: 10000 })
  return res.data
}

module.exports = { searchCards, getCard }
