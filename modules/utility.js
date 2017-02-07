function _getARandomNumber (lowerbound = 0, upperbound = 1) {
  lowerbound = Math.ceil(lowerbound)
  upperbound = Math.floor(upperbound)
  return Math.floor(Math.random() * (upperbound - lowerbound)) + lowerbound
}

export function getMyIPAddress () {
  return new Promise(function (resolve, reject) {
    let xhr = new window.XMLHttpRequest()
    xhr.addEventListener('load', () => {
      resolve(xhr.responseText)
    })
    xhr.open('GET', 'http://icanhazip.com')
    xhr.send()
  })
}

export function assignARandomHandle () {
  let adjectives = ['fiery', 'quick', 'crouching', 'dark', 'masterful', 'fabulous', 'victorious', 'scrappy', 'happy', 'sunny', 'rampant', 'stately']
  let nouns = ['tiger', 'bear', 'bunny', 'eagle', 'peacock', 'horse', 'zebra', 'leopard', 'gaur', 'wolf', 'cat', 'monkey', 'lemur', 'otter', 'giraffe']
  return adjectives[_getARandomNumber(0, adjectives.length)] + ' ' + nouns[_getARandomNumber(0, nouns.length)]
}

export function assignARandomIcon () {
  let icons = ['bag.svg', 'basketball.svg', 'bolt.svg', 'brush-alt.svg', 'crown.svg', 'gift.svg', 'location-arrow.svg', 'magnet.svg', 'marker-alt.svg', 'medall.svg', 'palette.svg', 'star.svg', 'thought.svg', 'truck.svg', 'wand.svg']
  return icons[_getARandomNumber(0, icons.length)]
}
