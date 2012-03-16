$(function() {
    var mq = 'handheld and (max-width: 480px), screen and (max-device-width: 480px), screen and (max-width: 600px)',
        mobile = (window.matchMedia(mq).matches) ? true : false,
        headerHeight = $('header').outerHeight();
        updateLoadPerc = (function() { 
            var $loadingEl = $('#loading-indicator'),
                $percEl = $('#loading-perc'),
                factor = $loadingEl.width() / 100;

            return function(perc) {
                if(perc >= 0 && perc <= 100) {
                    $percEl.text(perc + '%').css('width', (factor * perc));
                }
            }
        })();

    $('body').css('cursor', 'wait');

    function checkActiveSection($sections) {
        if(window.fullyLoaded) {
            $('body > section').each(function() {
                var st = $(window).scrollTop(),
                    thisOff = $(this).offset().top,
                    nextOff = $(this).next().offset().top;

                if(st >= thisOff && st < nextOff) {
                    $('header nav a[href*="' + $(this).attr('id') + '"]').addClass('current');
                } else {
                    $('header nav a[href*="' + $(this).attr('id') + '"]').removeClass('current');
                }
            });
        }
    }

    $(window).scroll(function() { 
        checkActiveSection(); 

        $(this).scrollTop() > 200 ? $('#back-to-top').fadeIn('fast') : $('#back-to-top').fadeOut('fast');
    });

    $('header nav a').click(function() { checkActiveSection(); });

    // Get data
    $.getJSON('data/stats.json', function(statsData) {
        rwclib.stats = statsData;
        rwclib.containerWidth = $('section').width();

        updateLoadPerc(25);

        $.getJSON('data/minutes.json', function(minuteData) {
            rwclib.minuteData = minuteData;
            updateLoadPerc(50);

            $.getJSON('data/words.json', function(wordData) {
                rwclib.wordData = wordData;
                updateLoadPerc(75);

                $.getJSON('data/events.json', function(eventData) {
                    rwclib.events = eventData;

                    sentiment.init($('#graph'), rwclib.minuteData);

                    if(mobile) {
                        sentiment.draw(2250, 300, 'stacked');
                        sentiment.attachScrollOnClick();
                    } else {
                        sentiment.draw(2250, 500, 'stacked');
                    }

                    players.init($('#players-container'), rwclib.minuteData);
                    players.draw();

                    words.init($('#words'), rwclib.wordData, rwclib.minuteData);
                    words.draw(_.keys(words.topFive));

                    updateLoadPerc(100);
                    window.fullyLoaded = true;

                    $('#loading-indicator').fadeOut(function() {
                        $('body').css('cursor', 'pointer');
                        $('body > section')
                            .hide()
                            .css({
                                'height': 'auto',
                                'visibility': 'visible'
                            })
                            .fadeIn();
                    });
                });
            });
        });
    });

    function reDraw() {
        if(mobile) {
            sentiment.draw(2250, 300, 'stacked');
            sentiment.attachScrollOnClick();
        } else {
            sentiment.draw(2250, 500, 'stacked');
        }

        words.init($('#words'), rwclib.wordData, rwclib.minuteData);

        players.draw();
    }

    $(window).resize(function() {
        clearTimeout(window.resizeInt);
        window.resizeInt = setTimeout(reDraw, 150);
    });
});


