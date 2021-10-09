// ==UserScript==
// @name         超星学习通助手2
// @namespace    https://greasyfork.org/users/29438
// @version      1.4.1
// @icon         https://tntfiles.com/preview/31c8a98f301329ede30e359d5ffba187381eb397faf33829a77e98dc9d0d7545.jpg
// @description  自动挂机看超星学习通MOOC(智慧树)，自动放视频，支持章节/作业，考试在另外脚本
// @author       程鹏
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @connect      huan.fm210.cn
// @run-at       document-end
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @supportURL   https://greasyfork.org/zh-CN/scripts/369625/feedback
// @require      https://unpkg.com/sweetalert/dist/sweetalert.min.js
// @license      MIT
// @antifeature  ads
// @antifeature  menbership
// @original-script https://greasyfork.org/scripts/369625
// @original-author wyn665817
// @original-license MIT
// ==/UserScript==

// 设置修改后，需要刷新或重新打开网课页面才会生效(0关闭，1开启)
var setting = {
    // 2E3 == 2000，科学记数法，表示毫秒数
    time: 2E3 // 默认响应速度为5秒，不建议小于3秒
    ,review: 0 // 复习模式，完整挂机视频(音频)时长，支持挂机任务点已完成的视频和音频
    ,queue: 0 // 队列模式，开启后任务点逐一完成，关闭则单页面所有任务点同时进行

    // 1代表开启，0代表关闭
    ,video: 1 // 视频支持后台、切换窗口不暂停，支持多视频
    ,work: 1 // 自动答题功能(章节测验)，作业需要手动开启查询，高准确率
    ,audio: 1 // 音频自动播放，与视频功能共享vol和rate参数
    ,book: 1 // 图书阅读任务点，非课程阅读任务点
    ,docs: 1 // 文档阅读任务点，PPT类任务点自动完成阅读任务
    // 本区域参数，上方为任务点功能，下方为独立功能
    ,jump: 1 // 自动切换标签、章节、课程(需要配置course参数)
    ,read: '0' // 挂机课程阅读时间，单位分钟
    ,total: 0 // 显示课程进度的统计数据，在学习进度页面的上方展示

    // 仅开启video(audio)时，修改此处才会生效
    ,line: '公网1' // 视频播放的默认资源线路
    ,http: '标清' // 视频播放的默认清晰度
    // 本区域参数，上方为video功能独享，下方为audio功能共享
    ,vol: '0' // 默认音量的百分数，设定范围：[0,100]，'0'为静音
    ,rate: '0' // 视频播放速率，最多2倍速，0为秒过,秒过大概率异常，后果自负

    // 仅开启work时，修改此处才会生效
    ,auto: 1 // 答题完成后自动提交，默认开启
    ,none: 0 // 无匹配答案时执行默认操作，关闭后若题目无匹配答案则会暂时保存已作答的题目
    ,scale: 1 // 富文本编辑器高度自动拉伸，用于文本类题目，答题框根据内容自动调整大小
    ,gs: 1 // 焦点跟随

    // 仅开启jump时，修改此处才会生效
    ,course: 1 // 当前课程完成后自动切换课程，仅支持按照根目录课程顺序切换，默认关闭
    ,lock: 1 // 跳过未开放(图标是锁)的章节，即闯关模式或定时发放的任务点，默认开启

},

_self = unsafeWindow,
url = location.pathname,
top = _self;


// 页面中转
if (url != '/studyApp/studying' && top != _self.top) document.domain = location.host.replace(/.+?\./, '');
if(document.getElementsByClassName("backOld fl").length==1){
    swal({
        title: "脚本加载完毕,请您务必阅读以下内容",
        text: "本脚本不支持新版脚本，即将自动返回旧版。\n拖动进度条、倍速播放、秒过100%产生不良记录，后果自负！\n用户点击“确认”或使用任何脚本即遵守协议，后续更新不再提示",
        icon: "success",
        button: "确认",
    });
    setTimeout(function(){
        document.getElementsByClassName("backOld fl")[0].click();
    },2000);
}
try {
    while (top != _self.top) {
        top = top.parent.document ? top.parent : _self.top;
        if (top.location.pathname == '/mycourse/studentstudy') break;
    }
} catch (err) {
    // console.log(err);
    top = _self;
}

var $ = _self.jQuery || top.jQuery,
parent = _self == top ? self : _self.parent,
Ext = _self.Ext || parent.Ext || {},
UE = _self.UE,
vjs = _self.videojs,
dl = 'https://d0.ananas.chaoxing.com/download/';

// 引入layui
$('head').append('<link href="https://www.layuicdn.com/layui/css/layui.css" rel="stylesheet" type="text/css" />');

String.prototype.toCDB = function() {
    return this.replace(/\s/g, '').replace(/[\uff01-\uff5e]/g, function(str) {
        return String.fromCharCode(str.charCodeAt(0) - 65248);
    }).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/。/g, '.');
};
_self.alert = console.log;

setting.normal = ''; // ':visible'
// setting.time += Math.ceil(setting.time * Math.random()) - setting.time / 2;
setting.job = [':not(*)'];

setting.video && setting.job.push('iframe[src*="/video/index.html"]');
setting.work && setting.job.push('iframe[src*="/work/index.html"]');
setting.audio && setting.job.push('iframe[src*="/audio/index.html"]');
setting.book && setting.job.push('iframe[src*="/innerbook/index.html"]');
setting.docs && setting.job.push('iframe[src*="/ppt/index.html"]', 'iframe[src*="/pdf/index.html"]');

if (url == '/mycourse/studentstudy') {
    _self.checkMobileBrowerLearn = $.noop;
    var classId = location.search.match(/cla[zs]{2}id=(\d+)/i)[1] || 0,
    courseId = _self.courseId || location.search.match(/courseId=(\d+)/i)[1] || 0;
    !setting.jump || setting.lock || $('#coursetree').on('click', '[onclick*=void], [href*=void]', function() {
        _self.getTeacherAjax(courseId, classId, $(this).parent().attr('id').slice(3));
    });
} else if (url == '/ananas/modules/video/index.html' && setting.video) {
    if (setting.review) _self.greenligth = Ext.emptyFn;
    vjs.hook('beforesetup', hookVideoB);
    vjs.hook('setup', hookVideoS);
    Ext.isIos = Ext.isAndroid = false;
} else if (url == '/work/doHomeWorkNew' || url == '/api/work' || url == '/work/addStudentWorkNewWeb') {
    top.courseId = location.search.match(/courseId=(\d+)/i)[1];
    if (!UE) {
        var len = ($ || Ext.query || Array)('font:contains(未登录)', document).length;
        setTimeout(len == 1 ? top.location.reload : parent.greenligth, setting.time);
    } else if (setting.work) {
        setTimeout(relieveLimit, 0);
        beforeFind();
    }
} else if (url == '/ananas/modules/audio/index.html' && setting.audio) {
    if (setting.review) _self.greenligth = Ext.emptyFn;
    vjs.hook('beforesetup', hookAudioB);
    vjs.hook('setup', hookAudioS);
} else if (url == '/ananas/modules/innerbook/index.html' && setting.book) {
    setTimeout(function() {
        if (getTip()) _self.setting ? _self.top.onchangepage(_self.getFrameAttr('end')) : _self.greenligth();
    }, setting.time);
} else if (url.match(/^\/ananas\/modules\/(ppt|pdf)\/index\.html$/) && setting.docs) {
    setTimeout(function() {
        if (getTip()) _self.setting ? _self.finishJob() : _self.greenligth();
    }, setting.time);
    frameElement.setAttribute('download', 1);
    if (_self.downloadNum == '') _self.downloadNum = '1';
} else if (url == '/knowledge/cards') {
    $ && checkToNext();
} else if (url.match(/^\/(course|zt)\/\d+\.html$/)) {
    setTimeout(function() {
        +setting.read && _self.sendLogs && $('.course_section:eq(0) .chapterText').click();
    }, setting.time);
} else if (url == '/ztnodedetailcontroller/visitnodedetail') {
    setting.read *= 60 / $('.course_section').length;
    setting.read && _self.sendLogs && autoRead();
} else if (url == '/mycourse/studentcourse') {
    var gv = location.search.match(/d=\d+&/g);
    setting.total && $('<a>', {
        href: '/moocAnalysis/chapterStatisticByUser?classI' + gv[1] + 'courseI' + gv[0] + 'userId=' + _self.getCookie('_uid') + '&ut=s',
        target: '_blank',
        title: '点击查看章节统计',
        style: 'margin: 0 25px;',
        html: '本课程共' + $('.icon').length + '节，剩余' + $('em:not(.openlock)').length + '节未完成'
    }).appendTo('.zt_logo').parent().width('auto');
}else if (location.hostname == 'i.mooc.chaoxing.com') {
    _self.layui.use('layer', function() {
        swal({
            title: "脚本加载完毕,请务必阅读以下内容",
            text: "拖动进度条、倍速播放、秒过100%产生不良记录，后果自负！\n用户点击“确认”或使用任何脚本即遵守协议，后续更新不再提示",
            icon: "success",
            button: "确认",
        });
    });
} else if (url == '/work/selectWorkQuestionYiPiYue') {
    submitAnswer(getIframe().parent(), $.extend(true, [], parent._data));
} else if (url == '/exam/test') {
    swal({
        title: "重要需知",
        text: "根据相关规定，本脚本不提供考试功能。各位用户好好学习。\n如若是开放性考试，可以使用搜题软件。",
        icon: "warning",
        button: "确认",
    });
    $('.page').eq(0).text("不支持的类型，请您好好学习哦");
};

function getTip() {
    return top != _self && jobSort($ || Ext.query);
}

function jobSort($) {
    var fn = $.fn ? [getIframe(1), 'length'] : [self, 'dom'],
    sel = setting.job.join(', :not(.ans-job-finished) > .ans-job-icon' + setting.normal + ' ~ ');
    if (!getIframe()[fn[1]] || getIframe().parent().is('.ans-job-finished')) return 0;
    if (!setting.queue || $(sel, fn[0].parent.document)[0] == fn[0].frameElement) return 1;
    setInterval(function() {
        $(sel, fn[0].parent.document)[0] == fn[0].frameElement && fn[0].location.reload();
    }, setting.time);
}

function getIframe(tip, win, job) {
    if (!$) return Ext.get(frameElement || []).parent().child('.ans-job-icon') || Ext.get([]);
    do {
        win = win ? win.parent : _self;
        job = $(win.frameElement).prevAll('.ans-job-icon');
    } while (!job.length && win.parent.frameElement);
    return tip ? win : job;
}

function hookVideoB(el, config) {
    var ExtArr = Ext.Array,
    line = ExtArr.filter(ExtArr.map(config.playlines, function(value, index) {
        return value.label == setting.line && index;
    }), function(value) {
        return Ext.isNumber(value);
    })[0] || 0,
    http = ExtArr.filter(config.sources, function(value) {
        return value.label == setting.http;
    })[0];
    config.playlines.unshift(config.playlines[line]);
    config.playlines.splice(line + 1, 1);
    config.plugins.videoJsResolutionSwitcher.default = http ? http.res : 360;
    config.plugins.studyControl.enableSwitchWindow = 1;
    config.plugins.timelineObjects.url = '/richvideo/initdatawithviewer?';
    config.plugins.seekBarControl.enableFastForward = 1;
    config.playbackRates = [1, 1.25, 1.5, 2];
    setting.queue || vjs.registerPlugin('studyControl', Ext.emptyFn);
    // config.preload = setting.tip ? 'auto' : 'none';
    return config;
}

function hookVideoS(player) {
    var a = '<a href="' + dl + _self.config('objectid') + '" target="_blank">',
    img = '<img src="' + dl + 'e363b256c0e9bc5bd8266bf99dd6d6bb" style="margin: 6px 0 0 6px;">';
    player.volume(Math.round(setting.vol) / 100 || 0);
    Ext.fly(player.controlBar.addChild('Button').el_).setHTML(a + img + '</a>').dom.title = '下载视频';
    player.on('loadstart', function() {
        getTip() && this.play().catch(Ext.emptyFn);
        this.playbackRate(setting.rate > 16 || setting.rate < 0.0625 ? 1 : setting.rate);
    });
    player.one(['loadedmetadata', 'firstplay'], function() {
        setting.two = setting.rate === '0' && setting.two < 1;
        setting.two && this.options_.plugins.seekBarControl.sendLog(this.children_[0], 'ended', Math.floor(this.cache_.duration));
    });
    player.on('ended', function() {
        Ext.fly(frameElement).parent().addCls('ans-job-finished');
    });
}

function hookAudioB(el, config) {
    config.plugins.studyControl.enableSwitchWindow = 1;
    config.plugins.seekBarControl.enableFastForward = 1;
    setting.queue || vjs.registerPlugin('studyControl', Ext.emptyFn);
    return config;
}

function hookAudioS(player) {
    var a = '<a href="' + dl + _self.config('objectid') + '" target="_blank">',
    img = '<img src="' + dl + 'e363b256c0e9bc5bd8266bf99dd6d6bb" style="margin: 6px 0 0 6px;">';
    player.volume(Math.round(setting.vol) / 100 || 0);
    player.playbackRate(setting.rate > 16 || setting.rate < 0.0625 ? 1 : setting.rate);
    Ext.fly(player.controlBar.addChild('Button').el_).setHTML(a + img + '</a>').dom.title = '下载音频';
    player.on('loadeddata', function() {
        getTip() && this.play().catch(Ext.emptyFn);
    });
    player.one('firstplay', function() {
        setting.rate === '0' && this.options_.plugins.seekBarControl.sendLog(this.children_[0], 'ended', Math.floor(this.cache_.duration));
    });
    player.on('ended', function() {
        Ext.fly(frameElement).parent().addCls('ans-job-finished');
    });
}

function relieveLimit() {
    if (setting.scale) _self.UEDITOR_CONFIG.scaleEnabled = false;
    $.each(UE.instants, function() {
        var key = this.key;
        this.ready(function() {
            this.destroy();
            UE.getEditor(key);
        });
    });
}

function beforeFind() {
    setting.regl = parent.greenligth || $.noop;
    if ($.type(parent._data) == 'array') return setting.regl();
    setting.div = $(
        '<div class="titOper" style=" width: 400px; background-color: #eee;position: fixed;right: 8px;top: 0px;z-index: 99999999;overflow-x: auto;">' +
            '<span class="layui-card-header" style="font-size: 14px;"><i class="layui-icon layui-icon-loading"></i>  题库初始化中</span>' +
            '<div  class="layui-card-body" style="font-size: 12px;" >答题跟随已自动开启...</div>' +
                '<button class="layui-btn layui-btn-primary layui-btn-sm" style="margin: 2px; margin-right: 20px;">暂停答题</button>' +
                '<button class="layui-btn layui-btn-primary layui-btn-sm" style="margin: 2px;">' + (setting.auto ? '取消本次自动提交' : '开启本次自动提交') + '</button>' +
                '<br>' +
                '<button class="layui-btn layui-btn-primary layui-btn-sm" style="margin: 2px; margin-right: 20px;">重新查询</button>' +
                '<button class="layui-btn layui-btn-primary layui-btn-sm" style="margin: 2px; margin-right: 20px;">折叠提示框</button>' +
        '<button class="layui-btn layui-btn-primary layui-btn-sm" style="margin: 2px;">取消跟随</button>' +
            '<div style="max-height: 300px; overflow-y: auto;">' +
                '<table cellpadding="0" cellspacing="0" width="100%" class="layui-table" lay-size="sm" id="studenCon">' +
                    '<thead>' +
                        '<tr>' +
                            '<th style="width: 25px; min-width: 25px;">题号</th>' +
                            '<th style="width: 60%; min-width: 130px;">题目</th>' +
                            '<th style="min-width: 130px;">答案</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tfoot style="display: none;">' +
                        '<tr>' +
                            '<th colspan="3">答案提示框 已折叠</th>' +
                        '</tr>' +
                    '</tfoot>' +
                    '<tbody>' +
                        '<tr>' +
                            '<td colspan="3">扫二维码题库查询更全</td>' +
                        '</tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>'
    ).appendTo('body').on('click', 'button, td', function() {
        var len = $(this).prevAll('button').length;
        if (this.nodeName == 'TD') {
            $(this).prev().length && GM_setClipboard($(this).text());
        } else if (!$(this).siblings().length) {
          $(this).parent().html('<i class="layui-icon layui-icon-loading"></i>正在搜索答案');
            setting.num++;
        } else if (len === 0) {
            if (setting.loop) {
                clearInterval(setting.loop);
                delete setting.loop;
                len = ['已暂停搜索', '继续答题'];
            } else {
                setting.loop = setInterval(findAnswer, setting.time);
                len = ['正在搜索答案...', '暂停答题'];
            }
            setting.div.children('div:eq(0)').html(function() {
                return $(this).data('html') || len[0];
            }).removeData('html');
            $(this).html(len[1]);
        } else if (len == 1) {
            setting.auto = !setting.auto;
            $(this).html(setting.auto ? '取消本次自动提交' : '开启本次自动提交');
        } else if (len == 2) {
            parent.location.reload();
        } else if (len == 3) {
            setting.div.find('tbody, tfoot').toggle();
        }else if (len == 4) {
            setting.gs = !setting.gs;
            $(this).html(setting.gs ? '取消跟随' : '开启跟随');
        }
    }).find('table, td, th').css('border', '1px solid').end();
    setting.lose = setting.num = 0;
    setting.data = parent._data = [];
    setting.over = '<button style="margin-right: 10px;">跳过此题</button>';
    setting.curs = $('script:contains(courseName)', top.document).text().match(/courseName:\'(.+?)\'|$/)[1] || $('h1').text().trim() || '无';
    setting.loop = setInterval(findAnswer, setting.time);
    var tip = ({undefined: '任务点排队中', 0: '等待切换中'})[getTip()];
    tip && setting.div.children('div:eq(0)').data('html', tip).siblings('button:eq(0)').click();
}

function findAnswer() {
    if (setting.num >= $('.TiMu').length) {
        var arr = setting.lose ? ['共有 <font color="red">' + setting.lose + '</font> 道题目待完善（已深色标注）', saveThis] : ['答题已完成', submitThis];
        setting.div.children('div:eq(0)').data('html', arr[0]).siblings('button:eq(0)').hide().click();
        return setTimeout(arr[1], setting.time);
    }
    var $TiMu = $('.TiMu').eq(setting.num),
    question = filterImg($TiMu.find('.Zy_TItle:eq(0) .clearfix')).replace(/^【.*?】\s*/, '').replace(/\s*（\d+\.\d+分）$/, ''),
    type = $TiMu.find('input[name^=answertype]:eq(0)').val() || '-1';
    if(setting.gs){
      $("html,body").animate({scrollTop: $('.TiMu').eq(setting.num).offset().top}, 1000);
    }


    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://huan.fm210.cn/api/answer?keyword=' + encodeURIComponent(question)+"&courseid="+top.courseId,
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        timeout: setting.time*3,
        onload: function(xhr) {
            if (!setting.loop) {
            }
            else if (xhr.status == 200) {
                var obj = $.parseJSON(xhr.responseText) || {};
                console.log(obj);
                if (obj.code) {
                    setting.div.children('div:eq(0)').html('<i class="layui-icon layui-icon-loading"></i>  正在搜索答案.....');
                    var td = '<td style="border: 1px solid;',
                    data = String(obj._source.da).replace(/&/g, '&amp;').replace(/<(?!img)/g, '&lt;');
                    obj.data = /^http/.test(data) ? '<img src="' + obj.data + '">' : obj.data;

                    $(
                        '<tr>' +
                            td + ' text-align: center;">' + $TiMu.find('.Zy_TItle:eq(0) i').text().trim() + '</td>' +
                            td + '" title="点击可复制">' + (question.match('<img') ? question : question.replace(/&/g, '&amp;').replace(/</g, '&lt')) + '</td>' +
                            td + '" title="点击可复制">' + (/^http/.test(data) ? obj.data : '') + data + '</td>' +
                        '</tr>'
                    ).appendTo(setting.div.find('tbody')).css('background-color', fillAnswer($TiMu.find('ul:eq(0)').find('li'), obj, type) ? '' : 'rgba(0, 150, 136, 0.6)');
                    setting.num++;
                }
                else {
                    setting.div.children('div:eq(0)').html(obj.data || setting.over + '服务器繁忙，正在重试...');
                }
              setting.div.children('span').html(obj.msg || '交流群740894629');
            }
            else if (xhr.status == 403) {
                var html = xhr.responseText.indexOf('{') ? '请求过于频繁，建议稍后再试' : $.parseJSON(xhr.responseText).data;
                setting.div.children('div:eq(0)').data('html', html).siblings('button:eq(0)').click();
            }
            else {
                setting.div.children('div:eq(0)').html(setting.over + '服务器异常，正在重试...反馈群740894629');
            }
        },
        ontimeout: function() {
            setting.loop && setting.div.children('div:eq(0)').html(setting.over + '服务器超时，15秒后再次请求...反馈群740894629');
        }
    });
}

function fillAnswer($li, obj, type) {
    var $input = $li.find(':radio, :checkbox'),
    str = String(obj._source.da).toCDB() || new Date().toString(),
    data = str.split(/#|\x01|\|/),
    opt = obj.opt || str,
    state = setting.lose;
    // $li.find(':radio:checked').prop('checked', false);
    obj.code > 0 && $input.each(function(index) {
        if (this.value == 'true') {
            data.join().match(/(^|,)(正确|是|对|√|T|ri|right|true)(,|$)/) && this.click();
        } else if (this.value == 'false') {
            data.join().match(/(^|,)(错误|否|错|×|F|wr|wrong|false)(,|$)/) && this.click();
        } else {
            var tip = filterImg($li.eq(index).find('.after')).toCDB() || new Date().toString();
            Boolean($.inArray(tip, data) + 1 || (type == '1' && str.indexOf(tip) + 1)) == this.checked || this.click();
        }
    }).each(function() {
        if (!/^A?B?C?D?E?F?G?$/.test(opt)) return false;
        Boolean(opt.match(this.value)) == this.checked || this.click();
    });
    if (type.match(/^[013]$/)) {
        $input.is(':checked') || (setting.none ? ($input[Math.floor(Math.random() * $input.length)] || $()).click() : setting.lose++);
    } else if (type.match(/^(2|[4-9]|1[08])$/)) {
        data = String(obj._source.da).split(/#|\x01|\|/);
        str = $li.end().find('textarea').each(function(index) {
            index = (obj.code > 0 && data[index]) || this.value || '';
            UE.getEditor(this.name).setContent(index.trim());
        }).length;
        (obj.code == 1 && data.length == str) || setting.none || setting.lose++;
    } else {
        setting.none || setting.lose++;
    }
    return state == setting.lose;
}

function saveThis() {
    if (!setting.auto) return setTimeout(saveThis, setting.time);
    setting.div.children('button:lt(3)').hide().eq(1).click();
    $('#tempsave').click();
    setting.regl();
}

function submitThis() {
    if (!setting.auto) {
    } else if (!$('.Btn_blue_1:visible').length) {
        setting.div.children('button:lt(3)').hide().eq(1).click();
        return setting.regl();
    } else if ($('#confirmSubWin:visible').length) {
        var btn = $('#tipContent + * > a').offset() || {top: 0, left: 0},
        mouse = document.createEvent('MouseEvents');
        btn = [btn.left + Math.ceil(Math.random() * 46), btn.top + Math.ceil(Math.random() * 26)];
        mouse.initMouseEvent('click', true, true, document.defaultView, 0, 0, 0, btn[0], btn[1], false, false, false, false, 0, null);
        _self.event = $.extend(true, {}, mouse);
        delete _self.event.isTrusted;
        _self.form1submit();
    } else {
        $('.Btn_blue_1')[0].click();
    }
    setTimeout(submitThis, Math.ceil(setting.time * Math.random()) * 2);
}

function checkToNext() {
    var $tip = $(setting.job.join(', '), document).prevAll('.ans-job-icon' + setting.normal);
    setInterval(function() {
        $tip.parent(':not(.ans-job-finished)').length || setting.jump && toNext();
    }, setting.time);
}

function toNext() {
    var $cur = $('#cur' + $('#chapterIdid').val()),
    $tip = $('span.currents ~ span'),
    sel = setting.review ? 'html' : '.blue';
    if (!$cur.has(sel).length && $tip.length) return $tip.eq(0).click();
    $tip = $('.roundpointStudent, .roundpoint').parent();
    $tip = $tip.slice($tip.index($cur) + 1).not(':has(' + sel + ')');
    $tip.not(setting.lock ? ':has(.lock)' : 'html').find('span').eq(0).click();
    $tip.length || setting.course && switchCourse();
}

function switchCourse() {
    GM_xmlhttpRequest({
        method: 'GET',
        url: '/visit/courses/study?isAjax=true&fileId=0&debug=',
        headers: {
            'Referer': location.origin + '/visit/courses',
            'X-Requested-With': 'XMLHttpRequest'
        },
        onload: function(xhr) {
            var $list = $('.curFile .courseName', xhr.responseText),
            index = $list.index($list.filter('[href*="courseid=' + top.courseId + '&"]')) + 1;
            index = index && $list.eq(index).attr('href');
            setting.course = index && goCourse(index);
        }
    });
}

function goCourse(url) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: function(xhr) {
            $.globalEval('location.href = "' + $('.articlename a[href]', xhr.responseText).attr('href') + '";');
        }
    });
}

function autoRead() {
    $('html, body').animate({
        scrollTop: $(document).height() - $(window).height()
    }, Math.round(setting.read) * 1E3, function() {
        $('.nodeItem.r i').click();
    }).one('click', '#top', function(event) {
        $(event.delegateTarget).stop();
    });
}


function submitAnswer($job, data) {
    $job.removeClass('ans-job-finished');
    data = data.length ? $(data) : $('.TiMu').map(function() {
        var title = filterImg($('.Zy_TItle .clearfix', this));
        return {
            question: title.replace(/^【.*?】\s*/, ''),
            type: ({单选题: 0, 多选题: 1, 填空题: 2, 判断题: 3})[title.match(/^【(.*?)】|$/)[1]]
        };
    });
    data = $.grep(data.map(function(index) {
        var $TiMu = $('.TiMu').eq(index);
        if (!($.isPlainObject(this) && this.type < 4 && $TiMu.find('.fr').length)) {
            return false;
        } else if (this.type == 2) {
            var $ans = $TiMu.find('.Py_tk, .Py_answer').eq(0);
            if (!$TiMu.find('.cuo').length && this.code) {
                return false;
            } else if (!$ans.find('.cuo').length) {
                this.option = $ans.find('.clearfix').map(function() {
                    return filterImg(this);
                }).get().join('#') || '无';
            } else if (this.code) {
                this.code = -1;
            } else {
                return false;
            }
        } else if (this.type == 3) {
            var ans = $TiMu.find('.font20:last').text();
            if ($TiMu.find('.cuo').length) {
                this.option = ({'√': '错误', '×': '正确'})[ans] || '无';
            } else if (!this.code) {
                this.option = ({'√': '正确', '×': '错误'})[ans] || '无';
            } else {
                return false;
            }
        } else {
            var text = $TiMu.find('.Py_answer > span:eq(0)').text();
            if ($TiMu.find('.dui').length && this.code && !/^A?B?C?D?E?F?G?$/.test(this.option)) {
                return false;
            } else if ($TiMu.find('.dui').length || text.match('正确答案')) {
                text = text.match(/[A-G]/gi) || [];
                this.option = $.map(text, function(value) {
                    return filterImg($TiMu.find('.fl:contains(' + value + ') + a'));
                }).join('#') || '无';
                this.key = text.join('');
            } else if (this.code) {
                this.code = -1;
            } else {
                return false;
            }
        }
        return this;
    }), function(value) {
        return value && value.option != '无';
    });
    setting.curs = $('script:contains(courseName)', top.document).text().match(/courseName:\'(.+?)\'|$/)[1] || $('h1').text().trim() || '无';
    data.length && GM_xmlhttpRequest({
        method: 'POST',
        url: 'sea of flowers' + $('#workId').val(),
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: 'course=' + encodeURIComponent(setting.curs) + '&data=' + encodeURIComponent((Ext.encode || JSON.stringify)(data)) + '&id=' + $('#jobid').val().slice(5)
    });
    $job.addClass('ans-job-finished');
}

function filterImg(dom) {
    return $(dom).clone().find('img[src]').replaceWith(function() {
        return $('<p></p>').text('<img src="' + $(this).attr('src') + '">');
    }).end().find('iframe[src]').replaceWith(function() {
        return $('<p></p>').text('<iframe src="' + $(this).attr('src') + '"></irame>');
    }).end().text().trim();
}
