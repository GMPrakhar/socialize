const express = require('express');
var ejs = require('ejs');
var session = require('express-session');
const app = express();

var server = require('http').createServer(app); 
var io = require('socket.io')(server);
app.use(express.static(__dirname));
app.use(session({secret:'Prak123'}));
const fs = require('fs');
var port    = parseInt(process.env.PORT, 10) || 8000;
var mongoo = require('mongodb');
var mongo = mongoo.MongoClient;
const url = "mongodb://localhost:27017";
const dbname = 'Social';
const client = new mongo(url);
var db;
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var onlineUsers = [];
var socketUsers = [];

client.connect(function(err)
{
	db = client.db(dbname);
	//client.close();
});

server.listen(port);
io.on('connection', function(socket)
{
	socket.on('online', function(data)
	{
		
		if(onlineUsers.indexOf(data.email!=-1))
		{
			console.log(onlineUsers);
			console.log("a client connected");
			onlineUsers.push(data.email);
			socketUsers.push(socket.id);
			io.emit('newOnline', {email: data.email}); 
		}
	});
	
	socket.on('disconnect', function()
	{
		console.log(onlineUsers);
		var ind = socketUsers.indexOf(socket.id);
		var email = onlineUsers[ind];
		if(ind!=-1)
		{
			socketUsers.splice(ind, 1);
			onlineUsers.splice(ind, 1);
			console.log("A user disconnected!" + email);
			io.emit('disconnected', {email: email});
		}
		
	});
	
	socket.on('lastReadUpdate', function(data)
	{
		var msgid = new mongoo.ObjectId(data.id);
	var updater = data.updater;
	var time = data.time;
	if(updater==1)
	{
		db.collection('Conversations').updateOne({_id: msgid}, {$set : {user1lastread:time}}, function(err, result)
		{				
			if(!err)
			{
				//res.end(JSON.stringify({message:"Good"}));
				socket.emit('lastReadUpdated', {id: data.id});
			}
			else
			{
				 //res.end(JSON.stringify({message: "Bad"}));
				throw err;
			 }
		});
	}
	else{
		db.collection('Conversations').updateOne({_id: msgid}, {$set : {user2lastread:time}}, function(err, result)
		{				
			if(!err)
			{
				//res.end(JSON.stringify({message:"Good"}));
			}
			else
			{
				 //res.end(JSON.stringify({message: "Bad"}));
				throw err;
			 }
		});
	}
	});
	
	socket.on('hi', function(data)
	{
		console.log(data);
	});


});
const addUser = function(db, user, req, res)
{
	res.writeHead(200, {'Content-Type': 'text/html'});
	const coll = db.collection('Users');
	coll.insertOne(user, function(err,result,callback)
	{
		var re = {status:1, message: ""};
		if(!err)
		{
			console.log("User added Succesfully");
			re.message="Success";
			res.write(JSON.stringify(re));
			sess = req.session;
			sess.user = {name: user.name, email: user.email, friends: user.friends, posts: user.posts};
			res.end();
		}
		else 
		{
			re.status=0;
			re.message="Failed with " + err;
			console.log("Error Occured:" + err);
			//callback = 0;
			res.write(JSON.stringify(re));
			res.end();
		}
		});
};

const addPost = function(db, post, req, res)
{
	res.writeHead(200, {'Content-Type': 'text/html'});
	const coll = db.collection('Posts');
	coll.insertOne(post, function(err,result,callback)
	{
		if(!err)
		{
			console.log("Post added Succesfully");
			coll.updateOne({count:{$exists:true}}, {$inc:{count:1}});
			//console.log(JSON.stringify(result.ops[0]));
			res.write(JSON.stringify(result.ops[0]));
			res.end();
		}
		else 
		{
			console.log("Error Occured:" + err);
			//callback = 0;
			res.write('Error while adding Post..');
		}
		});
};
app.get('/', async (req, res, next) => {
	//console.log(req.method);
  fs.readFile('index.html', function(err, data) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
  });

});
var calb = function(res)
{
	
};

app.post('/signup', function(req,res) {
	//console.log(req.body);
	var name = req.body.data.name;
	var email = req.body.data.email;
	var pass = req.body.data.pass;
	//console.log(req.body);
	var user = {name: name, email: email, pass: pass, friends: [], posts: [], profile_img: "images/all.png", friendreqsent: [],friendreqrec: []};
	addUser(db, user,req, res);
});

app.post('/login', function(req,res)
{
	var email = req.body.email;
	//console.log(email);io.
	//console.log(email);
	var pass = req.body.pass;
	//console.log(log);
	db.collection('Users').find({email: email, pass: pass}).toArray(function(err,result)
	{
		if(err) throw err;
		//console.log(result);
		if(!err)
		{
			sess = req.session;
			sess.user = result[0];
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<script>location.href="/home";</script>');
    res.end();
		}
	});
});

app.post('/fetchPosts', function(req,res)
{
	var friends = req.body.friends;
		db.collection('Posts').find({user: {$in:friends}}).toArray(function(err,result)
		{
		if(err) throw err;
		//console.log(result);
		if(!err)
		{
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write(JSON.stringify(result));
			res.end();
		}
		});
	
});

app.post('/fetchPostsProfile', function(req,res)
{
	var email = req.body.prof;
		db.collection('Posts').find({user: email}).toArray(function(err,result)
		{
		if(err) throw err;
		//console.log(result);
		if(!err)
		{
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write(JSON.stringify(result));
			res.end();
		}
		});
	
});
app.post('/likeUnlike', function(req,res)
{
	var id = req.body.id;
	var liked = req.body.liked;
	var newliked = [];
	//console.log(liked);
	db.collection('Posts').find({id:id}).toArray(function(err1,resul)
		{
		if(err1) throw err1;
		//console.log(result);
		if(!err1)
		{
			//res.writeHead(200, {'Content-Type': 'text/html'});			
			//res.end(JSON.stringify(resul[0].likes));
			newliked = resul[0].likes;
			if(liked=="")
			{
				var ind = -1;
				for(var j = 0; j < newliked.length; j++)
				{
					var like = newliked[j];
					if(like.email==req.body.email)
					{
						ind = j; break;
					}
				}
				if(ind!=-1)
				{newliked.splice(ind,1);
					
				db.collection('Posts').updateOne({id: id}, {$set:{likes:newliked}},function(err,result)
				{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{	
					res.writeHead(200, {'Content-Type': 'text/html'});			
					res.end(JSON.stringify(newliked));
						
			
				}
			
				});
			}
			}
			else
			{
				var user= {email: req.body.email, name: req.body.name};
				newliked.push(user);
				db.collection('Posts').updateOne({id: id}, {$set:{likes:newliked}},function(err,result)
				{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{	
					res.writeHead(200, {'Content-Type': 'text/html'});			
					res.end(JSON.stringify(newliked));
						
			
				}
			
				});
			}
		}
		});
	
		
});


app.get('/home', function(req,res)
{
	if(req.session.user){
  fs.readFile('home.ejs','utf-8', function(err, data) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    //res.write(data);
    var renderedHtml = ejs.render(data, {sess: req.session.user});
    res.end(renderedHtml);
  });
} 
else 
{
	res.write("Please login first");
	res.end();
}
});
app.get('/profile/:userID', function(req,res)
{
	if(req.session.user){
  fs.readFile('pages/profile.ejs','utf-8', function(err, data) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    //res.write(data);
    db.collection('Users').find({email:req.params.userID}).toArray(function(err,result)
	{
		if(err){
			
			}
		//console.log(result);
		if(!err)
		{
			if(result.length==0) res.end("Sorry no profile found for given data");
			else{
			var renderedHtml = ejs.render(data, {sess: req.session.user, profile: result[0]});
			res.end(renderedHtml);
		}
		}
	});
  });
} 
else 
{
	res.write("Please login first");
	res.end();
}
});

app.post('/addPost', function(req,res)
{
	let data = req.body.data;
	var user = req.session.user.email;
	var name = req.session.user.name;
	var likes = [];
	var date= new Date();
	db.collection('Posts').find({count:{$exists:true}}).toArray(function(err,result)
	{
		if(err) throw err;
		//console.log(result);
		if(!err)
		{
			var count = result[0].count;
			var post = {id: count, name: name, user: user, content: data, likes: likes, date: date};
			addPost(db,post,req,res);
			
		}
	});
});


app.post('/sendFriend', function(req,res)
{
	var email = req.session.user.email;
	var reqTo = req.body.email;
	
			db.collection('Users').updateOne({email:email}, {$addToSet:{friendreqsent:reqTo}},function(err,result)
				{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{	
					db.collection('Users').updateOne({email:reqTo}, {$addToSet:{friendreqrec:email}},function(err,result)
					{
					if(err) throw err;
				//console.log(result);
					if(!err)
					{	
						res.writeHead(200, {'Content-Type': 'text/html'});			
						res.end("done");
						
			
					}
			
					});
						
			
				}
			
				});
	
});

app.post('/cancelFriend', function(req,res)
{
	var email = req.session.user.email;
	var reqTo = req.body.email;
	
			db.collection('Users').updateOne({email:email}, {$pull:{friendreqsent:reqTo}},function(err,result)
				{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{	
					db.collection('Users').updateOne({email:reqTo}, {$pull:{friendreqrec:email}},function(err,result)
					{
					if(err) throw err;
				//console.log(result);
					if(!err)
					{	
						res.writeHead(200, {'Content-Type': 'text/html'});			
						res.end("done");
						
			
					}
			
					});
						
			
				}
			
				});
	
});

app.post('/acceptFriend', function(req,res)
{
	var email = req.session.user.email;
	var reqTo = req.body.email;
	
			db.collection('Users').updateOne({email:email}, {$addToSet:{friends:reqTo}, $pull:{friendreqsent:reqTo},$pull:{friendreqrec:reqTo}},function(err,result)
				{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{	
					db.collection('Users').updateOne({email:reqTo}, {$addToSet:{friends:email}, $pull:{friendreqrec:email},$pull:{friendreqsent:email}},function(err,result)
					{
					if(err) throw err;
				//console.log(result);
					if(!err)
					{	
						res.writeHead(200, {'Content-Type': 'text/html'});			
						res.end("done");
						
			
					}
			
					});
						
			
				}
			
				});
	
});

app.post('/getUser', function(req,res)
{
	var email = req.session.user.email;
	//console.log(email);
	//console.log(log);
	db.collection('Users').find({email: email}).toArray(function(err,result)
	{
		if(err) throw err;
		//console.log(result);
		if(!err)
		{
			db.collection('Users').find({email: {$in: result[0].friendreqrec}}).toArray(function(err,result1)
			{
				if(err) throw err;
				//console.log(result);
				if(!err)
				{
					var us = {user: result[0], reqs: [], olfr: [],frnames:[]}; 
					for(var i = 0;i < result1.length; i++)
					{
						us.reqs.push({email: result1[i].email,name: result1[i].name});
					}
					for(var i = 0;i < result[0].friends.length; i++)
					{
						if(onlineUsers.indexOf(result[0].friends[i])!=-1)
						{
							us.olfr.push(result[0].friends[i]);
						}
					}
					db.collection('Users').find({email: {$in: result[0].friends}}).toArray(function(err,result2)
					{
						if(err) throw err;
						//console.log(result);
							if(!err)
							{
								for(var i = 0;i < result2.length; i++)
								{
									us.frnames.push({email: result2[i].email,name: result2[i].name});
								}
								res.writeHead(200, {'Content-Type': 'text/html'});
								res.end(JSON.stringify(us));
							}
					});
				}
			});
		}
	});
});

app.get('/messages', function(req,res)
{
	
	if(req.session.user){
  fs.readFile('pages/messages.ejs','utf-8', function(err, data) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    //res.write(data);
    var renderedHtml = ejs.render(data, {sess: req.session.user});
    res.end(renderedHtml);
  });
}
});

app.post('/getConversations', function(req,res)
{
	var user = req.body.email;
	var conversations = [];
	db.collection('Conversations').find({$or:[{user1:user},{user2:user}]}).toArray(function(err,result)
	{
		for(var i = 0; i < result.length; i++)
		{
			var conv = {};
			if(result[i].user1 == user) 
			{
				conv.user = result[i].user2;
				conv.name = result[i].name2;
				conv.image = result[i].image2;
				conv.lastread = result[i].user1lastread;
				conv.userno = 1;
			}
			else 
			{
				conv.user = result[i].user1;
				conv.name = result[i].name1;
				conv.image = result[i].image1;
				conv.lastread = result[i].user2lastread;
				conv.userno = 2;
			}
			conv.messages = result[i].messages;
			conv.id = result[i]._id;
			conversations.unshift(conv);
		}
		    res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(JSON.stringify(conversations));
	});
});

app.post('/startConversations', function(req,res)
{
	var convos = req.body.convos;
	db.collection('Conversations').insertMany(convos, function(err, result)
	{				
		if(!err)
		{
			
	var user = req.body.email;
	var conversations = [];
	db.collection('Conversations').find({$or:[{user1:user},{user2:user}]}).toArray(function(err,result)
	{
		for(var i = 0; i < result.length; i++)
		{
			var conv = {};
			if(result[i].user1 == user) 
			{
				conv.user = result[i].user2;
				conv.name = result[i].name2;
				conv.image = result[i].image2;
			}
			else 
			{
				conv.user = result[i].user1;
				conv.name = result[i].name1;
				conv.image = result[i].image1;
			}
			conversations.unshift(conv);
		}
		    res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(JSON.stringify({convos: conversations, message: "Good"}));
	});
		}
		else
		{
			
			res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(JSON.stringify({message: "Bad"}));
		}
	});
});


app.post('/sendMessage', function(req,res)
{
	var msgid = new mongoo.ObjectId(req.body.id);
	var message = req.body.message;
	var to = req.body.to;
	console.log(msgid);
	io.emit('message', {message: message, reciever: to});
	db.collection('Conversations').updateOne({_id: msgid}, {$push : {messages:message}}, function(err, result)
	{				
		if(!err)
		{
			res.end(JSON.stringify({message:"Good"}));
		}
		else
		{
			 res.end(JSON.stringify({message: "Bad"}));
			throw err;
		 }
	});
});

/*socket.on('message', function(data)
{
	var msgid = data.id;
	var message = data.message;
	var to = data.to;
	console.log(socketUsers[onlineUsers.indexOf(message.sender)]);
	io.emit('hi', 'msg');
});*/

