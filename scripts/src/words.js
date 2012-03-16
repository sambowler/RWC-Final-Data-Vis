// TODO: Loading indicator
// TODO: Background colour of box in autosuggest should be the same as the line on the graph
// TODO: Axis labels
var words = {
    init: function(origin, overallData, minuteData) {
        this.origin = origin;
        this.overallData = overallData;
        this.allWords = _.extend(this.overallData['nz'], this.overallData['fra']),
        this.minuteData = _.pluck(minuteData, 'words');
        this.topStopwords = ['france', 'french', 'new', 'zealand', 'kiwi', 'blacks', 'bleus'];
        this.topFive = this.getTop(this.overallData, 5),

        this.refineMinuteData();

        $('#words-type-select').append('<option value="">-----------</option>');

        _.each(this.allWords, function(num, word) {
            var ucWord = String.capitalize(word);

            $('#words-type-select').append('<option value="' + word + '">' + ucWord + '</option');
        });

        function updateGraph() {
            var val = $('#words-type-select').val();

            switch(val) {
                case 'top-five':
                    $('#specific-words').fadeOut('fast');
                    words.draw(_.keys(words.topFive));
                    break;
                case 'specific':
                    $('#specific-words').fadeIn('fast');
                    break;
                default:
                    $('#specific-words').fadeOut('fast');
                    words.draw(val);
            }

            $(words.origin).removeClass();
        }

        $('#words-type-select').change(function() {
            var val = $(this).val(),
                to = 250;

            if(val) {
                if(val !== 'specific') {
                    $(words.origin).addClass('loading');
                    to = 0;
                }

                setTimeout(updateGraph, to);
            }

            return false;
        });

        $('#specific-words').submit(function() {
            if($('.as-values').val().length > 0) {
                var val = $('.as-values').val().split(',');

                $(words.origin).addClass('loading');

                words.draw(val);

                $(words.origin).removeClass('loading');
            }

            return false;
        });

        $('#specific-words-input').autoSuggest(this.constructAutoSuggestData(), {
            'selectedItemProp': 'name',
            'searchObjProps': 'name',
            'minChars': 2,
            'startText': 'Pick an available word'
        });
    },

    constructAutoSuggestData: function() {
        var data = [];

        _.each(this.allWords, function(num, word) {
            var obj = {
                // Hack for autoSuggest plugin
                'value': word,
                'name': word
            };

            data.push(obj);
        });

        return data;
    },

    // Removes all occurrences of words that aren't in the 100 most mentioned for each team
    refineMinuteData: function() {
        for(var i = 0, len = this.minuteData.length; i < len; i++) {
            for(var team in this.minuteData[i]) {
                _.each(this.minuteData[i][team], function(count, word) {
                    if(!_.has(words.overallData[team], word)) {
                        delete words.minuteData[i][team][word];
                    }
                });
            }
        }
    },

    getTop: function(data, num, team, min) {
        var obj;

        if(min) {
            obj = (team) ? data[min][team] : this.concatObj(data[min].fra, data[min].nz);
        } else {
            obj = (team) ? data[team] : this.concatObj(data.fra, data.nz);
        }

        var filterFunction = function(num, word) { return !_.contains(words.topStopwords, word); },
            sortedArr = _.filter(obj, filterFunction).sort(function(a, b) { return a - b; }).reverse(),
            top = _.first(sortedArr, num),
            wordsObj = {};

        for(i = 0; i < top.length; i++) {
            _.each(obj, function(thisNum, word) {
                if(thisNum === top[i] && !_.has(wordsObj, word) && _.size(wordsObj) < num) wordsObj[word] = thisNum;
            });
        }

        return wordsObj;
    },

    concatObj: function() {
        var concat = {};

        for(i = 0; i < arguments.length; i++) {
            for(var word in arguments[i]) {
                if(!_.has(concat, word)) {
                    concat[word] = arguments[i][word];
                } else {
                    concat[word] += arguments[i][word];
                }
            }
        }

        return concat;
    },

    draw: function(wordsStr, width, height) {
        this.graph.draw(wordsStr);
    },

    getWordData: function(word) {
        var retArr = [];

        for(var i = 0, len = this.minuteData.length; i < len; i++) {
            var count = 0;

            for(var team in this.minuteData[i]) {
                if(this.minuteData[i][team][word]) {
                    count += this.minuteData[i][team][word];
                }
            }

            retArr.push(count);
        }

        return retArr;
    },

    drawEvent: function(min, x, width) {
        if(min in rwclib.events) {
            var event = rwclib.events[min],
                tooltipContent = '<h4>Minute ' + min + '</h4><p>' + event.type + ': ';

            switch(event.type) {
                case 'Substitution':
                    if(typeof event.on === 'object') {
                        var on = event.on.join(' and '),
                            off = event.off.join(' and ');

                        tooltipContent += on + ' came on for ' + off + ', respectively';
                    } else {
                        tooltipContent += event.on + ' came on for ' + event.off;
                    }
                    break;
                case 'Penalty': case 'Conversion':
                    tooltipContent += 'Kicked by ' + event.scorer;
                    break;
                case 'Try':
                    tooltipContent += 'Scored by ' + event.scorer;
                    break;
            }

            tooltipContent += '</p>';

            if($('.events', this.origin).length == 0) $(this.origin).append('<div class="events" />');

            $('<span class="event"></span>')
                .appendTo('.events', this.origin)
                .attr('data-event-type', event.type.toLowerCase())
                .attr('data-minute', min)
                .css({
                    'width': width,
                    'position': 'absolute',
                    'top': 0,
                    'left': x
                })
                .tipTip({
                    'content': tooltipContent,
                    'defaultPosition': 'top',
                    'delay': 350
                });
        }
    },
};

words.graph = {
    draw: function(wordsStr) {
        var tempData = [],
            data = [],
            lines = [];

        if(typeof wordsStr === 'object') {
            for(var i = 0; i < wordsStr.length; i++) {
                if(wordsStr[i].length > 0) {
                    lines.push(wordsStr[i]);        
                    tempData.push(words.getWordData(wordsStr[i]));
                }
            }
        } else {
            lines.push(wordsStr);
            tempData.push(words.getWordData(wordsStr));
        }

        for(i = 0; i < tempData[0].length; i++) {
            var obj = { 'minute': (i + 1) };

            for(j = 0; j < tempData.length; j++) {
                obj[lines[j]] = tempData[j][i];
            }

            data.push(obj);
        }

        Morris.Line({
            'element': $(words.origin).attr('id'),
            'lineColors': ['#1F78B4', '#A65628', '#33A02C', '#E31A1c', '#FF7F00', '#F781BF'],
            'data': data.reverse(),
            'xkey': 'minute',
            'ykeys': lines,
            'labels': _.map(lines, function(label) { return String.capitalize(label); }),
            'numLines': 10,
            'parseTime': false
        }).redraw();
    },
};
