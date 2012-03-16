var rwclib = {
    'containerWidth': 640,
    'nz': {
        'fans': 'kiwi',
        'country': 'New Zealand',
        'colour': 'rgb(0, 0, 0)',
    },
    'fra': {
        'fans': 'french',
        'country': 'France',
        'colour': 'rgb(24, 91, 161)',
    },
}

String.capitalize = function(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};
