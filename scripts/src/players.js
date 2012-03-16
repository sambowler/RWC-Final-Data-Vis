// TODO: BETTER LAYOUT!!!
var players = {
    playerStats: {},
    extractedData: {},
    imageBase: 'images/players/',

    init: function(origin, data) {
        this.origin = origin;
        this.data = data;

        this.constructPlayerInfo();
    },

    constructPlayerInfo: function() {
        var stats = {};

        for(var minute in this.data) {
            var players = this.data[minute].players;

            for(var player in players) {
                var thisPlayer = players[player];

                if(typeof thisPlayer === 'object') {
                    if(typeof stats[player] !== 'object') {
                        stats[player] = {
                            'neg': 0,
                            'pos': 0,
                            'tweets': 0,
                            'team': thisPlayer.team,
                            'name': player
                        };
                    }

                    stats[player]['neg'] += thisPlayer.neg;
                    stats[player]['pos'] += thisPlayer.pos;
                    stats[player]['tweets'] += thisPlayer.tweets;
                }
            }
        }

        // Remove players with an insignificant amount of tweets about them
        stats = _.filter(stats, function(obj) { return obj.tweets > 100 ? true : false; });

        // Sort the data by positive percentage
        this.playerStats = _.sortBy(stats, function(obj) {
            return (obj.tweets > 30) ? obj.pos / (obj.tweets / 100) : false;
        });
    },

    getPlayers: function(count) {
        var ret = [];

        if(!count) {
            ret = this.playerStats;
        } else if(count && count > 0) { // Get from start (negative)
            var i = this.playerStats.length - 1,
                stop = i - count;

            while(i > stop) {
                ret.push(this.playerStats[i]);

                i--;
            }
        } else if(count && count < 0) { // Get from end (positive)
            var i = 0;

            while(i < Math.abs(count)) {
                ret.push(this.playerStats[i]);

                i++;
            }
        }

        return ret;
    },

    draw: function() {
        var players = this.getPlayers();

        this.chart.maxTweets = _.max(players, function(obj) { return obj.tweets; }).tweets;
        this.chart.motm = _.max(players, function(obj) { return obj.pos / (obj.tweets / 100); }).name;
        this.chart.worst = _.min(players, function(obj) { return obj.pos / (obj.tweets / 100); }).name;

        for(var i = 0; i < players.length; i++) {
            this.chart.draw(players[i]);
        }

        $(this.origin).masonry({
            'itemSelector': '.chart'
        });
    },

    getRealPlayerName: function(underscoredName) {
        return String.capitalize(underscoredName.replace(/_/g, ' '));
    },

    drawPieChart: function(canvas, name, pos, width, height) {
        var ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        var centre = radius = canvas.width / 2;

        // Draw background circle
        this.drawPieChartArc(ctx, centre, radius, Math.PI * 2, 'rgb(215, 25, 28)');

        // Draw arc representing positivity
        this.drawPieChartArc(ctx, centre, radius, (Math.PI * 2 * (pos / 100)), '#1A9641');

        // Draw gradient on top of the pie chart
        var grad = ctx.createRadialGradient(centre, centre, 0, centre, centre, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.drawPieChartArc(ctx, centre, radius, Math.PI * 2, grad);

        this.drawPlayerImage(ctx, centre, centre, 35, name);
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

    drawPlayerImage: function(ctx, x, y, radius, playerName, stroke) {
        var img = new Image();

        img.onload = function() {
            ctx.save();

            ctx.beginPath();

            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, 0, Math.PI * 2, true);
            ctx.clip();

            ctx.drawImage(img, (x - radius), (y - radius), (radius * 2), (radius * 2));

            if(stroke) {
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.stroke();
            }

            ctx.restore();
        }

        img.src = this.imageBase + playerName + '.jpg';
    },
};

players.chart = {
    maxTweets: 0,
    maxChartWidth: 350,
    minChartWidth: 150,
    colours: {
        'positive': [139, 70, 35],
        'negative': [359, 78, 47]
    },
    animate: {
        'ms': 150,
        'easing': 'ease-in-out'
    },
    rad: Math.PI / 180,

    draw: function(playerData) {
        if($('#' + playerData.name).length == 0) {
            var org = players.origin,
                widthFactor = this.maxTweets / 100,
                widthPerc = (playerData.tweets / widthFactor) / 100,
                posPerc = playerData.pos / (playerData.tweets / 100),
                classes = ['chart'],
                data = {
                    'positive': posPerc, 
                    'negative': (100 - posPerc)
                };

            if(playerData.name == this.motm) classes.push('motm');
            if(playerData.name == this.worst) classes.push('worst');

            $('<div class="' + classes.join(' ') + '" id="' + playerData.name + '" />').appendTo(org);

            this.width = this.height = Math.round(this.maxChartWidth * widthPerc) + this.minChartWidth,
            this.center = this.width / 2;
            this.radius = this.center * .9;
            this.startAngle = 0;
            this.p = Raphael(playerData.name, this.width, this.height);

            for(var type in data) {
                this.drawSegment(type, data[type]);
            }

            var imgWidth = imgHeight = this.radius * .5,
                xy = this.center - (imgWidth / 2);

            // players.imageBase + playerData.name + '.png'
            this.p.image(players.imageBase + playerData.name + '.png', xy, xy, imgWidth, imgHeight);

            var tooltipContent = '<h4>' + players.getRealPlayerName(playerData.name) + '</h4>';

            tooltipContent += '<p>' + playerData.tweets + ' tweets</p>';
            tooltipContent += '<p>' + playerData.pos + ' positive</p>';
            tooltipContent += '<p>' + playerData.neg + ' negative</p>';

            $('#' + playerData.name).tipTip({
                'content': tooltipContent,
                'defaultPosition': 'top',
                'delay': 150
            });
        }
    },

    drawSegment: function(type, perc) {
        var self = this,
            deg = perc * (360 / 100),
            c = this.colours[type],
            startColour = 'hsl(' + c[0] + ',' +  c[1] + ',' + c[2] + ')',
            endColour = 'hsl(' + c[0] + ',' +  c[1] + ',' + (c[2] + 10) + ')',
            arc = this.drawArc(
                    this.center, 
                    this.center, 
                    this.radius, 
                    this.startAngle, 
                    (this.startAngle + deg), 
                    {
                        'fill': '90-' + startColour + '-' + endColour,
                        'stroke': ''
                    }
            ),
            arcMiddle = this.startAngle + (deg / 2);
            x = this.center + (this.radius / 1.7) * Math.cos(-arcMiddle * this.rad),
            y = this.center + (this.radius / 1.7) * Math.sin(-arcMiddle * this.rad),
            textStyles = { 
                'font-weight': 'bold', 
                'fill': 'rgba(255, 255, 255, 0.7)',
                'font-size': this.calculateFontSize(this.width)
            },
            text = this.p.text(x, y, Math.round(perc) + '%').attr(textStyles);

        arc.hover(function() {
            var center = this.attrs.path[0][1];

            arc.stop().animate({ 
                'transform': 's1.05,1.05,' + center + ',' + center 
            }, self.animate.ms, self.animate.easing);
        }, function() {
            arc.stop().animate({ 'transform': '' }, self.animate.ms, self.animate.easing);
        });

        this.startAngle += deg;
    },

    drawArc: function(x, y, radius, startAngle, endAngle, params) {
        var x1 = x + radius * Math.cos(-startAngle * this.rad),
            x2 = x + radius * Math.cos(-endAngle * this.rad),
            y1 = y + radius * Math.sin(-startAngle * this.rad),
            y2 = y + radius * Math.sin(-endAngle * this.rad);

        return this.p.path(["M", x, y, "L", x1, y1, "A", radius, radius, 0, +(endAngle - startAngle > 180), 0, x2, y2, "z"]).attr(params);
    },

    calculateFontSize: function(width) {
        return (width * .09) + 'px';
    },
};
