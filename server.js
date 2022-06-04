#!/usr/bin/env node
const _host_ = 'localhost';
const _database_ = 'database_name';
const _user_ = 'root';
const _password_ = 'password';
//var io = require('socket.io').listen(2020);
//HTTPS SERVER
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(888, function() {
  console.log('Listening on port: 777');
});
//SERVER
var siofu = require("socketio-file-upload");
var mysql = require('mysql');
const fs = require('fs');
var MySQLEvents = require('mysql-events');
var mail = require('./mailer.js');
var eventos = [];
var trivia = [];
var ID_evento;
var cache = [];
var winners = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
var _ip;
var restore = [];
var time_offset = (((1000 * 60) * 60) * 4);
var end_time_offset = (((1000 * 60) * 60) * 3);
var mails = [];
var event_stopped = false;
var game_event;
var mail_flag = false;
//_daa es el array de todos los usuarios que estan jugando
var _data = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
var _timeouts = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
var ten_mins = 60000;
var fecha_fin_concierto = 0;
var db = mysql.createConnection({
    host: _host_,
    user: _user_,
    password: _password_,
    database: _database_
});
db.connect(function(err){
});
var dsn = {
  host:     'localhost',
  user:     'root',
  password: 'mdi.db'
};
var mysqlEventWatcher = MySQLEvents(dsn);
var watcher = mysqlEventWatcher.add(
  'william_lawson.eventos',
  function (oldRow, newRow, event) {
    
     //row inserted
    if (oldRow === null) {
      //insert code goes here
      db.query('SELECT * FROM eventos WHERE id = '+newRow.fields.id)
      .on('result', function(w){
        eventos[newRow.fields.id] = Object.assign({}, w);
      })
      .on('end', function(){
        io.sockets.emit("setup", eventos, trivia, null,_ip, winners);
      });
    }
    if (newRow === null) {
      //delete code goes here
      eventos[oldRow.fields.id] = null;
      stop_event();
      //io.sockets.emit('event_change', 0, null);
    }
     //row updated
    if (oldRow !== null && newRow !== null) {
        //console.log(newRow.fields);
        //update code goes here
        if(newRow.fields.activado){
            console.log("evento activado "+new Date(Date.now()));
            eventos[newRow.fields.id] = newRow.fields;
            ID_evento = newRow.fields.id;
             fecha_fin_concierto = newRow.fields.fecha_fin;
             console.log(fecha_fin_concierto);
            mails = [];
            //console.log(eventos);
            start_event();
            io.sockets.emit('event_change', 1, fecha_fin_concierto, null);
        }else if(newRow.fields.activado == 0 && newRow.fields.caduco == null){
            console.log("what?");
            //stop_event();
            //io.sockets.emit('event_change', 0, null);
        }
    }
  },null/*, 
  "match string"*/
);

//restore database at boot
db.query('SELECT * FROM posiciones INNER JOIN usuarios ON posiciones.userid = usuarios.id_usuario AND posiciones.ocupado <> 0')
.on('result', function(data){
    restore.push(data);
})
.on('end', function(){
    for(x in restore){
        var _start_time_stamp = restore[x].end_time;
        var _current_timestamp = Date.now();
        var distance = _start_time_stamp - _current_timestamp;
        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        var _restore_data = new Object();
        _restore_data.ind = restore[x].id;
        _restore_data.formattedTime = minutes+":"+seconds;
        _restore_data.time = restore[x].start_time;
        _restore_data.endtime = restore[x].end_time;
        _restore_data.factor = restore[x].factor;
        _restore_data.sqlid = restore[x].userid;
        _restore_data.userid = restore[x].id_red;
        _restore_data.email = restore[x].email;
        _restore_data.color = restore[x].color;
        _data[_restore_data.ind - 1] = _restore_data;
    }
});
console.log(_data);
db.query('SELECT * FROM eventos WHERE caduco IS NULL')
.on('result', function(data){
  if(data.activado == 1){
    fecha_fin_concierto = data.fecha_fin;
    console.log(fecha_fin_concierto);
    ID_evento = data.id;
    start_event();
    //io.emit.sockets('start_event', 1);
  }
    eventos[ID_evento] = Object.assign({}, data);
})
.on('end', function(){
});
function stop_event(){
  clearInterval(game_event);
  var _winners = [];
  console.log("STOPPING EVENT");
  console.log("RETRIEVING WINNERS");
  db.query('SELECT * FROM posiciones WHERE userid IS NOT NULL')
  .on('result', function(data){
    //console.log("win");
    //console.log(data);
    var a = new Object();
    a.userid = data.userid;
    //_winners.push(data.userid);
    //console.log(typeof data.id);
    //console.log(winners[data.id-1]);
    winners[data.id] = new Object();
    winners[data.id].id_usuario = data.userid;
      db.query('SELECT * FROM usuarios WHERE id_usuario = '+data.userid)
      .on('result', function(informacion_ganador){
        //var _tmp = new Object();
        a.nombre_ganador = informacion_ganador.nombre;
        a.email_ganador = informacion_ganador.email;
        console.log("GATHERING WINNER INFORMATION");
        //winners[data.id]["informacion"] = _tmp;
        console.log(a);
        _winners.push(a);
      })
      .on('end', function(){
         console.log("Result");
          console.log(_winners);
          winners = _winners;
          console.log(winners);
      });


  })
  .on('end', function(){
   
    io.sockets.emit('event_change', 0, null, winners);
  });

  
  
}
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
function start_event(){
  event_stopped = false;
  winners = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
  _data = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
  //limpio la tabla posiciones
  console.log("LIMPIANDO TABLA POSICIONES...");
  db.query('UPDATE posiciones SET userid=null,start_time=null,end_time=null,color=null,factor=null,ocupado=null WHERE 1')
  .on('result', function(data){
  })
  .on('end', function(){
    console.log("OK.");
  });
  console.log("START EVENT");
    game_event = setInterval(game,1000); 
}

function game(e){
      //console.log(new Date(Date.now()).toString());
      //console.log("fecha_fin_milisegundos", fecha_fin_concierto);
      //console.log("fecha_fin", new Date(parseInt(fecha_fin_concierto) - end_time_offset));
      //console.log("fecha_actual", new Date(Date.now()));
      //console.log("fecha_actual_local", new Date(Date.now() - time_offset));
/*      var _dd = new Date(Date.now()).toString();
      console.log(_dd);
      _dd = Date.parse(_dd);*/
      //var time_left_to_end_event = parseInt(fecha_fin_concierto) - (Date.now() - ((60*60) * 1000));
      var time_left_to_end_event = (parseInt(fecha_fin_concierto) - end_time_offset) - ((Date.now() - time_offset) );
      console.log(new Date(Date.now()));
      var _start_time_stamp = fecha_fin_concierto;
        var _current_timestamp = Date.now() - (((1000 * 60) * 60));
        var _distance = _start_time_stamp - _current_timestamp;
        var _days = Math.floor(_distance / (1000 * 60 * 60 * 24));
        var _hours = Math.floor((_distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var _minutes = Math.floor((_distance % (1000 * 60 * 60)) / (1000 * 60));
        var _seconds = Math.floor((_distance % (1000 * 60)) / 1000)
        _hours = (_hours < 0 ? 0 : _hours);
        _minutes = (_minutes < 0 ? 0 : _minutes);
        _seconds = (_seconds < 0 ? 0 : _seconds);

      console.log(_hours+":"+_minutes+":"+_seconds);
     // console.log(time_offset);
      //console.log(time_left_to_end_event);

      if(_hours == 0 && _minutes == 0 && _seconds == 0){
            console.log("----------------TERMINADO------------");
            console.log(event_stopped, typeof event_stopped);
        //EVENT END
          if(!event_stopped){
            event_stopped = true;
            eventos[ID_evento] = null;
            //io.sockets.emit('event_change', 0, null);

            db.query('UPDATE eventos SET activado = 0, caduco = 1 WHERE id = "'+ID_evento+'"')
            .on('result', function(k){
            })
            .on('end', function(){
              console.log("EVENT END");
              eventos[ID_evento - 1] = null;
              var ready = false;
              var _i;
              var _c = 0;
              var _a = [];
              mail_flag = false;
              //SET WINNERS
              db.query('SELECT p.userid, u.email FROM posiciones p, usuarios u WHERE p.userid IS NOT NULL AND u.id_usuario = p.userid')
              .on('result', function(w){
                mail_flag = false;
                _a.push(Object.assign({}, w));
                _i = w.userid;
                var _mail = w.email;
                db.query('SELECT id FROM participaciones WHERE id_usuario = '+_i+' ORDER BY id DESC LIMIT 1')
                .on('result', function(y){
                  db.query('UPDATE participaciones SET ganador = 1 WHERE id = '+y.id)
                  .on('result', function(z){
                  })
                  .on('end', function(){
                  });
                })
                .on('end', function(){
                });
              })
              .on('end', function(){
                for(x in _a){
                  if(mails.length == 0){
                    mails.push(_a[x].email);
                    mail.bacardiEmail(''+_a[x].email+'', "g");
                    continue;
                  }
                  for(var z = 0; z < mails.length; z++){
                    if(mails[z] == _a[x].email){
                      mail_flag = true;
                    }
                    if(z == (mails.length - 1)){
                      if(!mail_flag){
                        mails.push(_a[x].email);
                        mail.bacardiEmail(''+_a[x].email+'', "g");
                      }
                    }
                  }
                  
                  if(x == (_a.length - 1)){
                    //STOP EVENT
                    
                  }
                }
                //console.log(Object.size(_a));
                //WINNERS
                // io.sockets.emit('event_change', 0, null);
                 console.log("END FOR GANDORES ARRAY LOOP");
                  stop_event();
                    //io.sockets.emit('event_change', 0, null);
              });
            });

          }
            
      }


      for(a in _data){
        if(_data[a] != null){
            var _start_time_stamp = _data[a].endtime;
            var _current_timestamp = Date.now();
            var distance = _start_time_stamp - _current_timestamp;
            var days = Math.floor(distance / (1000 * 60 * 60 * 24));
            var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((distance % (1000 * 60)) / 1000);
            minutes = (minutes<0?0:minutes);
            seconds = (seconds<0?0:seconds);
            _data[a].formattedTime = minutes+":"+seconds;
        }
      }
      io.sockets.emit('send', _data);
}

function insert_log(transaction){
    transaction.position = (transaction.position != undefined ? transaction.position : null );
    transaction.id_pregunta = (transaction.id_pregunta != undefined ? transaction.id_pregunta : null );
    if(transaction.position != null){
      var dinit = new Date(parseInt(_data[transaction.position].time));
      var finit = dinit.getFullYear()+"-"+(dinit.getMonth() + 1)+"-"+dinit.getDate()+" "+dinit.getHours()+":"+dinit.getMinutes()+":"+dinit.getSeconds();
      var dfin = new Date(parseInt(_data[transaction.position].endtime));
      var ffin = dfin.getFullYear()+"-"+(dfin.getMonth() + 1)+"-"+dfin.getDate()+" "+dfin.getHours()+":"+dfin.getMinutes()+":"+dfin.getSeconds();
    }else{
      var finit = null;
      var ffin = null;
    }
      db.query('INSERT INTO participaciones (id_usuario, id_evento, posicion, inicio, fin, ganador) VALUES ("'+transaction.id_usuario+'", "'+ID_evento+'", "'+transaction.position+'", "'+finit+'", "'+ffin+'", 0)')
      .on('result', function(response){
      })
      .on('end', function(){
      });
}
function logs(action, information){
  var _i = new Object();
  _i.accion = action;
  _i.informacion = information;
  fs.readFile('logs/logs.json', (err, data) => {
    if (err) throw err;
    var _e = JSON.parse(data);
     //console.log(_e);
    _e.push(_i);
    fs.writeFile("logs/logs.json", JSON.stringify(_e), function(err) {
      cache = null;
      if(err) {
          return console.log(err);
      }

      //console.log("The file was saved!");
    });
  });
}
io.on('connection', function(socket) {
  //console.log(winners);
  var _dd = new Date(Date.now()).toString();
  //console.log(_dd);
  //console.log(new Date(Date.now()).toLocaleString());
  //console.log(new Date(Date.now()).toLocaleTimeString());//solo tiempo local
  //console.log(new Date(Date.now()).toLocaleDateString());//solo fecha local

  //console.log(Date.parse(_dd));
  //console.log(new Date(_dd));
/*  console.log(fecha_fin_concierto);
  console.log(Date.now());*/
/*    var _information = JSON.stringify(socket.handshake, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Duplicate reference found
              try {
                  // If this value does not reference a parent it can be deduped
                  return JSON.parse(JSON.stringify(value));
              } catch (error) {
                  // discard key if value cannot be deduped
                  return;
              }
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  });*/
    var _mip = socket.handshake.address.split("::ffff:")[1];
    console.log(_mip);
    var _o = new Object();
    _o.ip = _mip;
    _o.tipo = "conexion";
    //logs("conexion", _o);
    var uploader = new siofu();
    uploader.dir = __dirname + "/users";
    uploader.chunkSize = 1024 * 100;
    uploader.listen(socket);

    console.log(socket.id);
    uploader.on("error", function(event){
        console.log("Error from uploader", event);
    });
    trivia = [];
    db.query('SELECT * FROM trivia')
    .on('result', function(data){
      trivia.push(Object.assign({}, data));
    })
    .on('end', function(){
      //console.log(eventos);
      io.sockets.connected[socket.id].emit("setup", eventos, trivia, socket.id, _mip, winners);
      //console.log(eventos);
    });

    socket.on('cfn', function(new_name, old_name){
      var _o = (__dirname + "/users/" + old_name);
      var _n = (__dirname + "/users/" + new_name + ".jpg");
      console.log(_o);
      console.log(_n);
      fs.rename(_o, _n, (error) => { /* handle error */ });
    });

    socket.on('registrar', function(user_socket_id, user_mail, user_phone, image_name, birth, fb_id, ciudad, nombre){
      console.log(user_socket_id, user_mail, user_phone, image_name, birth, fb_id, ciudad, nombre);
      var info = new Object();
      info.email = user_mail;
      info.phone = user_phone;
      info.i_name = image_name;
      console.log("TRYING TO REGISTER "+user_socket_id);
      console.log(info);
      info.sql_id = "";
        db.query('SELECT COUNT(*), id_usuario, nombre, email, phone, fecha_registro FROM usuarios WHERE email = "'+user_mail+'"')
        .on('result', function(data){
          if(data['COUNT(*)'] == 0){
            //console.log("Nuevo registro");
              db.query('INSERT INTO usuarios (id_red, nombre, email, phone, fecha_registro, fecha_nacimiento, ciudad) VALUES ("'+fb_id+'", "'+nombre+'", "'+user_mail+'", "'+user_phone+'", NOW(), "'+birth+'", "'+ciudad+'")')
              .on('result', function(response){
                console.log(response.insertId);
                info.sql_id = response.insertId;
                var _reg = new Object();
                _reg.email = user_mail;
                _reg.id_bd = response.insertId;
                //logs("registro", _reg);
                io.sockets.connected[user_socket_id].emit("registro_callback", info);
              })
              .on('end', function(){
              });
          }else{
            console.log(" user exists");
            info.sql_id = data["id_usuario"];
            var _login = new Object();
            _login.email = user_mail;
            _login.id_bd = data["id_usuario"];
           // logs("login", _login);
            io.sockets.connected[user_socket_id].emit("registro_callback", info);
          }
        })
        .on('end', function(){

        });
    });
    socket.on('duplicate-time', function(_index, factor){
      var ind = _data[_index].ind;
      _data[_index].factor = factor;
      _data[_index].endtime = (_data[_index].time + (60000 * 2));
      clearTimeout(_timeouts[_index].timeout);
      db.query('UPDATE posiciones SET end_time="'+(_data[_index].time + (60000 * 2))+'", factor = 2 WHERE id = "'+(ind+1)+'"')
      .on('result', function(data){
      })
      .on('end', function(){
      });

      var current = Date.now();
      _timeouts[_index] = null;
      _timeouts[_index] = new Object();
      _timeouts[_index].timeout = setTimeout(function(e){
          var b = ind;
          this.myid = b;
          var _u_id = _data[b].sqlid;

         db.query('UPDATE posiciones SET start_time="'+_data[b].time+'", end_time="'+_data[b].endtime+'", color="'+_data[b].color+'", ocupado = 0  WHERE id = "'+(b + 1)+'"')
        .on('result', function(data){
        })
        .on('end', function(){
          mail.bacardiEmail(''+_data[b].email+'');
          _data[b] = null;
          _timeouts[b] = null;
          console.log(" timeout 2");
        });

      }, ((_data[_index].time + (60000*2)) - current));
      //}, ((_data[g].time + 600000) - current));
             
/*        for(g in _data){
            if(_data[g] != null){
                if(_data[g].email == _mail){
                    var id = user_id;
                    var ind = _data[g].ind;
                    _data[g].factor = factor;
                    _data[g].endtime = (_data[g].time + (60000 * 2));
                    clearTimeout(_timeouts[g].timeout);
                    db.query('UPDATE posiciones SET end_time="'+(_data[g].time + (60000 * 2))+'", factor = 2 WHERE id = "'+(ind+1)+'"')
                    .on('result', function(data){
                    })
                    .on('end', function(){

                    });
                    
                    var current = Date.now();
                    _timeouts[g] = null;
                    _timeouts[g] = new Object();
                    _timeouts[g].timeout = setTimeout(function(e){
                        var b = ind;
                        this.myid = b;
                        var _u_id = _data[b].sqlid;

                       db.query('UPDATE posiciones SET start_time="'+_data[b].time+'", end_time="'+_data[b].endtime+'", color="'+_data[b].color+'", ocupado = 0  WHERE id = "'+(b + 1)+'"')
                      .on('result', function(data){
                      })
                      .on('end', function(){
                        mail.bacardiEmail(''+_data[b].email+'');
                        _data[b] = null;
                        _timeouts[b] = null;
                        console.log(" timeout 2");
                      });

                    }, ((_data[g].time + (60000*2)) - current));
                    //}, ((_data[g].time + 600000) - current));
             
                }
            }
        }*/
    });


    
    socket.on('new-transaction', function(transaction){
      console.log("Transaction");
      db.query('INSERT INTO jugadas (id_evento, id_usuario, id_pregunta, respuesta, fecha_participacion) VALUES ("'+ID_evento+'", "'+transaction.id_usuario+'", "'+transaction.id_pregunta+'", "'+transaction.respuesta_usuario+'", NOW())')
      .on('result', function(response){
        var _jugada = new Object();
        _jugada.id_bd = transaction.id_usuario;
        _jugada.fecha = response.fecha_participacion;
        //logs("jugada", _jugada);
      })
      .on('end', function(){

        //insert_log(transaction);
      });
    });
    socket.on('new-data', function(data) {
        for(x in _data){
            if(_data[x] != null){
                if(_data[x].email == data.email){
                    console.log("El usuario ya se encuentra en el array");
                    return;
                }
            }
            
        }
        if(_data[data.ind] == null){

            data.time = Date.now();
            data.endtime = Date.now() + 60000;
            //data.endtime = Date.now() + 600000;
            _data[data.ind] = data;
            db.query('UPDATE posiciones SET userid="'+data.sqlid+'", start_time="'+data.time+'", end_time="'+data.endtime+'", color="'+data.color+'", factor = 1, ocupado = 1 WHERE id = "'+(data.ind + 1)+'"')
            .on('result', function(k){
            })
            .on('end', function(){
              var _o = new Object();
              _o.id_usuario = data.sqlid;
              _o.position = data.ind;
              insert_log(_o);
            });
            console.log(_data[data.ind]);
            _timeouts[data.ind] = new Object();
            _timeouts[data.ind].timeout = setTimeout(function(){
                var id = data.ind;

                db.query('UPDATE posiciones SET start_time="'+_data[id].time+'", end_time="'+_data[id].endtime+'", color="'+_data[id].color+'", factor = 1, ocupado = 0 WHERE id = "'+(_data[id].ind + 1)+'"')
                .on('result', function(data){
                })
                .on('end', function(){
                    mail.bacardiEmail(''+_data[id].email+'');
                    _data[id] = null;
                    _timeouts[id] = null;
                    console.log("timeout 1");

                });

            }, (1000*60)); 
            //}, (1000*60) * 10);
            io.sockets.emit('send', _data);
        }
    });

/*    socket.on('generate_trivia', function(position){

    });*/

});


