// All billing arithmetic happens in integer paise to avoid floating point drift.
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => Math.round(paise) / 100;

module.exports = { toPaise, toRupees };
