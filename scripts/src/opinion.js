// FIXME: Bar graphs on resize
var sentiment = {
    drawn: false,
    keyContainer: $('#sentiment-key'),

    init: function(origin, data) {
        this.origin = origin;

        // Remove the 0th minute
        data.shift();
        this.data = data;
        this.elCount = this.data.length;

        $(origin).append('<div id="canvas-container"><canvas>Your browser doesn\'t support canvas.</canvas></div>');

        this.canvas = $(origin).find('canvas')[0];
        this.ctx = this.canvas.getContext('2d');

        this.calculateMaxTweetCount();
        this.minuteInfo.draw();

        $('#graph-type').change(function() {
            sentiment.changeType($(this).val());
        });
    },

    calculateMaxTweetCount: function() {
        var max = 0;

        for(var i = 0; i < this.elCount; i++) {
            var thisMin = this.data[i];

            max = thisMin.tweet_count > max ? thisMin.tweet_count : max;
        }

        this.maxTweetCount = max;
    },

    draw: function(width, height, type) {
        this.width = width;
        this.height = height;

        var canvas = this.canvas,
            ctx = this.ctx;

        canvas.height = this.height;
        canvas.width = this.width;

        this.minuteWidth = Math.floor(this.canvas.width / this.elCount);
        this.canvasMiddle = this.canvas.height / 2;

        this.drawGraphLines();
        this.drawMiddleSection(25);

        this.extractData();
        this.updateType(type);
        this.drawYAxis(25);

        this.drawn = true;
    },

    changeType: function(type) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGraphLines();
        this.updateType(type);
    },

    updateType: function(type) {
        this.currentGraphType = type;
        $(this.origin).removeClass().addClass(type);

        switch(type) {
            case 'stacked':
                this.stackedGraph.draw(this.ctx, this.extractedData);
                break;
            case 'heat':
                this.heatGraph.draw(this.ctx, this.extractedData);
                break;
            default:
                this.stackedGraph.draw(this.ctx, this.extractedData);
        }
    },

    extractData: function() {
        var graphHeight = this.topBottom,
            factor = this.maxTweetCount / graphHeight;

        this.extractedData = {
            'nz': [],
            'fra': []
        };

        for(var i = 0; i < this.elCount; i++) {
            var thisMin = this.data[i],
                nz = {
                    'height': Math.round(thisMin.team_1_tweets / factor),
                    'positivity': thisMin.sentiment.team_1
                },
                fra = {
                    'height': Math.round(thisMin.team_2_tweets / factor),
                    'positivity': thisMin.sentiment.team_2
                };

            this.extractedData['nz'].push(nz);
            this.extractedData['fra'].push(fra);
        }
    },

    drawGraphLines: function() {
        var ctx = this.ctx;

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';

        ctx.beginPath();

        // Draw X Lines
        var lineCount = this.elCount + 1;

        for(i = 0; i < lineCount; i++) {
            // http://stackoverflow.com/a/7607321
            var x = i * this.minuteWidth + 0.5;

            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
        }

        this.graphWidth = (lineCount - 1) * this.minuteWidth + 0.5;

        ctx.closePath();
        ctx.stroke();
    },

    drawMiddleSection: function(height) {
        var yPos = this.canvasMiddle - (height / 2);
        this.drawLabels(yPos, height);

        // Store the positions for use when drawing the graph
        this.teamGraphHeight = this.topBottom = this.canvasMiddle - (height / 2);
        this.bottomTop = this.canvasMiddle + (height / 2);

        $('#team-info-container div').height(this.topBottom).css('lineHeight', this.topBottom + 'px');
    },

    drawLabels: function(yPos, height) {
        var container = $('<div class="x-axis" />').appendTo('#canvas-container');

        $(container).css({
            'position': 'absolute',
            'left': 0,
            'top': 0,
            'height': '100%',
            'width': this.canvas.width,
            'lineHeight': this.canvas.height + 'px'
        });

        // Draw X axis labels
        for(i = 0; i < this.elCount; i++) {
            var minute = i + 1,
                span = $('<span data-minute="' + minute + '" style="width: ' + this.minuteWidth + 'px">' + minute + '</span>')
                    .appendTo(container)
                    .click(function() {
                        sentiment.handleMinuteClick(this);
                    });

            if(minute in rwclib.events) {
                var event = rwclib.events[minute],
                    tooltipContent = '<h4>Minute ' + minute + '</h4><p>' + event.type + ': ';

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

                $(span)
                    .attr('data-event-type', event.type.toLowerCase())
                    .tipTip({
                        'content': tooltipContent,
                        'defaultPosition': 'top',
                        'delay': 350
                    });
            }
        }

        this.labelHeight = height;
    },

    drawLine: function(lineWidth, startX, startY, finishX, finishY, colour) {
        var ctx = this.ctx;

        startX += 0.5;
        startY += 0.5;
        finishX += 0.5;
        finishY += 0.5;

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = colour;

        ctx.beginPath();

        ctx.moveTo(startX, startY);
        ctx.lineTo(finishX, finishY);

        ctx.closePath();
        ctx.stroke();
    },

    drawYAxis: function(middleHeight) {
        if(!this.origin.prev().hasClass('y-axis')) {
            // Five, six, seven, eight!
            var steps = 250,
                teamIntervalCount = Math.floor(this.maxTweetCount / steps) + 1,
                axisEl = $('<div class="y-axis" />').insertBefore(this.origin);

            $(axisEl).height(this.height);

            for(i = 0; i < teamIntervalCount; i++) {
                var top = i * (this.teamGraphHeight / teamIntervalCount);

                $(axisEl).append('<span style="top: ' + top + 'px">' + ((teamIntervalCount - (i + 1)) * steps) + '</span>');
            }

            $(axisEl).append('<span class="middle" style="height: ' + middleHeight +'px"></span>');

            for(i = 0; i < teamIntervalCount; i++) {
                var top = i * (this.teamGraphHeight / teamIntervalCount) + this.teamGraphHeight - 4;

                $(axisEl).append('<span style="top: ' + top + 'px">' + (i * steps) + '</span>');
            }
        }
    },

    handleMinuteClick: function(self) {
        var minute = $(self).attr('data-minute');

        $(this.origin)
            .find('[data-minute]')
            .removeClass('active')
            .end()
            .find('.x-axis')
            .addClass('active-minute');

        $(self).addClass('active');

        var left = $(self).offset().left - $(this.origin).offset().left + $('#canvas-container').scrollLeft() + this.minuteWidth;

        this.minuteInfo.update(left, minute);
    },

    attachScrollOnClick: function() {
        this.minuteInfo.scrollOnClick = true;
    },
};

sentiment.minuteInfo = {
    scrollOnClick: false,

    // TODO: Animate element coming in from right
    draw: function() {
        var html = '<div class="sentiment"><canvas class="pie-chart" /></div><ol class="word-graph" />';

        this.origin = $('#minute-info');
        this.els = {
            'nz': $(this.origin).find('.nz').append(html),
            'middle': $(this.origin).find('.middle'),
            'fra': $(this.origin).find('.fra').append(html)
        };
    },

    update: function(left, min) {
        // Cast minId to a string so it's not evaluated as false
        var minId = '' + (min - 1),
            data = sentiment.data[minId];

        if(this.origin.not(':visible')) {
            this.origin.prev().width('56%');
            this.origin.width('40%').show();
        }

        $(this.origin).find('h3').text('Minute ' + min);

        for(var el in this.els) {
            var thisEl = this.els[el],
                pieChartWidth = 150,
                wordsWidth = $(thisEl).width() - pieChartWidth - 40;

            if(el != 'middle') {
                var team = ($(thisEl).hasClass('nz')) ? 'team_1' : 'team_2',
                    positivity = data.sentiment[team],
                    tweets = data[team + '_tweets'],
                    sentimentEl = $(thisEl).find('.sentiment'),
                    wordsEl = $(thisEl).find('.word-graph'),
                    wordsData = words.getTop(words.minuteData, 5, $(thisEl).attr('class'), minId);

                $(thisEl).height(sentiment.teamGraphHeight);

                this.updateSentimentEl(sentimentEl, positivity, pieChartWidth, pieChartWidth);
                this.updateTopWords(wordsEl, tweets, wordsData, wordsWidth);
            } else {
                $(thisEl).html('<span style="width: ' + pieChartWidth + 'px;">Sentiment</span><span style="width: ' + wordsWidth + 'px;">Most Used Words</span><div id="minute-info-close"></div>');
            }
        }

        $('#minute-info-close').click(function() {
            sentiment.origin
                .width('96%')
                .find('[data-minute]')
                .removeClass('active');

            $('#minute-info').hide();
        });

        if(this.scrollOnClick) {
            $(window).scrollTop($(this.origin).offset().top);
        }
    },

    drawPieChart: function(canvas, pos, width, height) {
        var ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var centre = radius = canvas.width / 2,
            circle = Math.PI * 2,
            pos = circle * (pos / 100),
            grad = ctx.createRadialGradient(centre, centre, 0, centre, centre, radius);

        this.drawPieChartArc(ctx, centre, radius, circle, 'rgb(215, 25, 28)');
        this.drawPieChartArc(ctx, centre, radius, pos, '#1A9641');

        grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.drawPieChartArc(ctx, centre, radius, circle, grad);
    },

    drawPieChartArc: function(ctx, centre, radius, distance, colour) {
        ctx.beginPath();

        ctx.moveTo(centre, centre);
        ctx.arc(centre, centre, radius, 0, distance, false);
        ctx.lineTo(centre, centre);

        ctx.closePath();

        ctx.fillStyle = colour;
        ctx.fill();
    },

    // TODO: Actual numbers of pos/neg
    updateSentimentEl: function(container, pos, width, height) {
        $(container).width(width);

        this.drawPieChart($(container).find('canvas')[0], pos, width, height);

        if($(container).find('p').length == 0) {
            $(container).append('<p class="pos" /><p class="neg" />');
        }

        $(container).find('.pos').text(pos + '% positive');
        $(container).find('.neg').text((100 - pos) + '% negative');
    },

    // TODO: Click on word to go to words tab
    updateTopWords: function(el, tweets, data, containerWidth) {
        var $container = $(el).empty(),
            graphWidth = containerWidth * .7,
            factor = tweets / 100;

        $container.width(containerWidth).append('<li>Total (' + tweets + ') <span style="width: ' + graphWidth + 'px;"></span></li>');

        for(var word in data) {
            $container.append('<li>' + word + ' (' + data[word] + ') <span style="width: ' + Math.round(data[word] / factor) + 'px;"></span></li>');
        }
    },
};

sentiment.heatGraph = {
    colours: {
        '31-40': 'rgb(215, 48, 39)',
        '41-50': 'rgb(252, 141, 89)',
        '51-60': 'rgb(254, 224, 139)',
        '61-70': 'rgb(255, 255, 191)',
        '71-80': 'rgb(217, 239, 139)',
        '81-90': 'rgb(145, 207, 96)',
        '91-100': 'rgb(26, 152, 80)'
    },
    lightColours: ['41-50', '51-60', '61-70', '71-80', '81-90'],

    draw: function(ctx, data) {
        this.drawKey();

        for(var team in data) {
            for(var i = 0, len = data[team].length; i < len; i++) {
                var thisData = data[team][i],
                    x = i * sentiment.minuteWidth,
                    y;

                if(team == 'nz') {
                    y = sentiment.topBottom - thisData.height;
                } else if(team == 'fra') {
                    y = sentiment.bottomTop;
                }

                x += 0.5;
                y += 0.5;

                var range = this.getRange(thisData.positivity);

                ctx.fillStyle = this.colours[range];
                ctx.fillRect(x, y, sentiment.minuteWidth, thisData.height);

                thisData.range = range;
            }
        }
    },

    getRange: function(positivity) {
        var thisRange = '';

        for(var range in this.colours) {
            var currRange = range.split('-');

            if(positivity >= +currRange[0] && positivity <= +currRange[1]) thisRange = range;
        }

        return thisRange;
    },

    drawKey: function() {
        sentiment.keyContainer.find('span').remove();

        for(var range in this.colours) {
            var colour = '#FFF';

            if(this.lightColours.indexOf(range) != -1) colour = '#000';

            sentiment.keyContainer.append('<span style="background-color: ' + this.colours[range] + '; color: ' + colour + '">' + range + '%</span>');
        }
    },
};

sentiment.stackedGraph = {
    colours: {
        'positive': 'rgb(26, 152, 80)',
        'negative': 'rgb(215, 48, 39)'
    },

    draw: function(ctx, data) {
        this.drawKey();

        for(var team in data) {
            for(var i = 0, len = data[team].length; i < len; i++) {
                var thisData = data[team][i],
                    x = i * sentiment.minuteWidth,
                    y,
                    negativeHeight = this.calculateHeights(thisData.height, thisData.positivity);

                if(team == 'nz') {
                    y = sentiment.topBottom - thisData.height;
                    negativeY = y;
                } else if(team == 'fra') {
                    y = sentiment.bottomTop;
                    negativeY = y + (thisData.height - negativeHeight);
                }

                x += 0.5;
                y += 0.5;
                negativeY += 0.5;

                ctx.fillStyle = this.colours['positive'];
                ctx.fillRect(x, y, sentiment.minuteWidth, thisData.height);

                ctx.fillStyle = this.colours['negative'];
                ctx.fillRect(x, negativeY, sentiment.minuteWidth, negativeHeight);
            }
        }
    },

    calculateHeights: function(fullHeight, positivity) {
        var factor = fullHeight / 100,
            negativity = 100 - positivity;

        return Math.round(negativity * factor);
    },

    drawKey: function() {
        sentiment.keyContainer.find('span').remove();

        for(var type in this.colours) {
            sentiment.keyContainer.append('<span style="background-color: ' + this.colours[type] + '; color: #FFF">' + type + '</span>');
        }
    },
};
