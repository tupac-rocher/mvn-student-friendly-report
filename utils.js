/**
 * 
 * @param {Number} number 
 * @returns the number rounded to 2 decimal places
 */
const roundNumber = (number) => {
    return Math.round((number + Number.EPSILON) * 100) / 100
}

module.exports = { roundNumber };