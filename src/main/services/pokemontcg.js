const axios = require('axios')

const BASE = 'https://api.pokemontcg.io/v2'

async function searchCards(query) {
  const params = {}
  const numMatch = query.match(/^\d+\/\d+$/) || query.match(/^[a-z]{2,6}\d*-\d+$/i)

  if (numMatch) {
    params.q = `number:"${query}"`
  } else {
    params.q = `name:"${query}*"`
    params.orderBy = '-set.releaseDate'
    params.pageSize = 30
  }

  const res = await axios.get(`${BASE}/cards`, { params, timeout: 10000 })
  return res.data.data || []
}

async function getCard(id) {
  const res = await axios.get(`${BASE}/cards/${id}`, { timeout: 10000 })
  return res.data.data
}

module.exports = { searchCards, getCard }
