/**
 * Generates a random number following a normal (Gaussian) distribution
 * rather than a flat distribution. Mimics human reaction times.
 * Uses the Box-Muller transform.
 */
function gaussianRandom(min, max) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    
    // Transform to mean of 0.5 and scale
    num = num / 10.0 + 0.5; 
    
    // Resample if out of bounds
    if (num > 1 || num < 0) return gaussianRandom(min, max);
    
    // Scale to min/max
    return Math.floor(num * (max - min + 1) + min);
}

/**
 * Parses Spintax formatted strings: "{Hello|Hi|Hey} there! How is {your day|it going}?"
 * Returns a randomized string.
 */
function parseSpintax(text) {
    if (!text) return text;
    
    let parsedText = text;
    const spintaxRegex = /{([^{}]+)}/g;
    
    // Keep replacing while there are matches
    while (spintaxRegex.test(parsedText)) {
        parsedText = parsedText.replace(spintaxRegex, (match, contents) => {
            const choices = contents.split('|');
            const randomChoice = choices[Math.floor(Math.random() * choices.length)];
            return randomChoice;
        });
    }
    
    return parsedText;
}

module.exports = { gaussianRandom, parseSpintax };
