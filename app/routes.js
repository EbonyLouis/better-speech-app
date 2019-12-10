module.exports = function(app, passport, multer, db, ObjectId, Nexmo) {
  var accountSID = process.env.TWILIO_ACCOUNT_SID
  var authToken = process.env.TWILIO_ACCOUNT_TOKEN
  var twilio = require('twilio');
  var client = new twilio(accountSID, authToken);

  // normal routes =================================================



  // show the home page (will also have our login links)
  app.get('/', function(req, res) {
    console.log('i am rendering')
    res.render('login.ejs', {message: ""});
  });

  app.get('/signup', function(req, res) {
    res.render('signup.ejs', {message: ""});
  });
  app.get('/parentSignup', function(req, res) {
    res.render('sign_up.ejs', {message: ""});
  });
  app.get('/parentLogin', function(req, res) {
    res.render('parentLogin.ejs', {message: ""});
  });
  app.get('/calendar', function(req, res) {
    res.render('calendar.ejs', {message: ""});
  });

  app.get('/dashboard', function(req, res) {
    res.render('dashboard2.ejs', {patientList: null});
  });
  app.get('/lock_screen', function(req, res) {
    console.log('this is user info',req.user)
    res.render('lock_screen.ejs', {
      user : req.user
    })
  });
  app.get('/thankYou', function(req, res) {
    res.render('thankYou.ejs', {
      user : req.user
    })
  });


  app.get('/newPatient', function(req, res) {
    res.render('newPatient.ejs', {patient: null});
  });

// sending reminder text to doctor about appointments for that day ***************************
  app.post('/textAppointments', (req, res) => {
  var patientId = ObjectId(req.body.patientId)
  db.collection('appointments').find().toArray((err, result) => {
      if (err) return console.log(err)
      const date = new Date()
          // below dates in js go from 0 to 11 so adding 1 to get 1-12 for the months
      const stringDate = (date.getMonth()+1) + '/' + date.getDate() + '/' + date.getFullYear()
      const todaysAppointments = []
  // there are 86,400 seconds in a day and multiply by 1000 to get how many miliseconds in one day
      let earliestDate = new Date((new Date()).getTime() + 86400*1000)
      let earliestPatient
      let databaseTime
      for(let i=0;i<result.length;i++){
        console.log(result[i])
        // below is so i can add a space btwn the time and "am/pm" bcuz in my database it's saved without spaces
        databaseTime = new Date(result.date + ' ' + result[i].time.replace(/(am|pm)/, " $1"))
        if(databaseTime < earliestDate){
          earliestDate = databaseTime
          earliestPatient = result[i]
        }
        console.log('these are the dates', result[i].date)
        if(result[i].date === stringDate)
        todaysAppointments.push(result[i])
      }

      console.log('this is the number',req.user.phone,req.user.local.phone)
      console.log('this is the user object',req.user)
      const number = '+' + 1 + req.user.local.phone
      let appointment
      if(todaysAppointments.length>0){
      appointment = `You have ${todaysAppointments.length} appointments today, starting at ${earliestDate}, Have a great day!`
    }else{
      appointment = `You don't have any appointments scheduled for today, Enjoy the day off!`
    }
      console.log(appointment, number)


      client.messages.create({
            body: appointment,
            to: number,  // Text this number
            from: '+12254354825' // From a valid Twilio number
              })
        .then((message) => console.log('**********',message.sid));
        console.log('saved to database')

        if (err) return console.log(err)
        console.log('saved to database')
        res.redirect('/patientSearch')

    })
  })

  // creating new patient in the database *****************************************************
  app.post('/newPatient', (req, res) => {
    db.collection('patients').save({keyword: req.body.keyword, name: req.body.name, diagnosis: req.body.diagnosis, DOB: req.body.DOB, maindoctor: req.body.maindoctor, mothername: req.body.mothername, fathername: req.body.fathername, number: req.body.number, email: req.body.email, address: req.body.address, progress: [], privateNotes: [], publicNotes: [], progress:[{month1: 0}, {month2: 0}, {month3: 0}, {month4: 0}, {month5: 0}]}, (err, result) => {
      if (err) return console.log(err)
      console.log('saved to database')
      res.redirect(`/patient?name=${req.body.name}`)
    })
  })

  // parent creating upcoming appointments***********************************************************

  app.post('/createAppointment', (req, res) => {
    var patientId = ObjectId(req.body.patientId)
    db.collection('appointments').save({date:req.body.date, time:req.body.time,reasonText: req.body.reasonText,doctornote: req.body.notes, childId: patientId, completed: false}, (err, result) => {
      if (err) return console.log(err)
      console.log('saved to database')
      res.redirect('/parentView')
    })
  })

  // patient info grabbing the info from the database to render on the page **************************
  app.post('/patientSearch', function(req, res) {
    let patientSearch = req.body.patientSearch.charAt(0).toUpperCase() + req.body.patientSearch.substring(1)
    const filter = {}
    if (patientSearch) {
      filter.name = new RegExp(patientSearch)
      console.log("this is the filter", filter.name)
    }

    db.collection('patients').find(filter).toArray((err, result) => {
      if (err) return console.log(err)
      res.render('all_patients.ejs', {
        // user : req.user,
        patientList: result
      })
    })
  });

  // accessing just their childs page  ***********************************************************************



  app.get('/parentView', isLoggedIn, function(req, res) {
    var parentId = ObjectId(req.session.passport.user)
    var childId;
    var children;
    db.collection('users').find({
      "_id": parentId
    }).toArray((err, parentResult) => {
      console.log('this is parent results',parentResult);
      children = parentResult[0].children[0]
      childId = children.childId
      console.log('this is the childs id:',childId)
      db.collection('patients').find({

        "_id": childId
      }).toArray((err, result) => {
        db.collection('appointments').find({childId: ObjectId(childId)}).toArray((err, appointmentResult) => {
          console.log('this is results at the end', appointmentResult);
          if (err) return console.log(err)
          res.render('parentChildProfileView.ejs', {
            appointments: appointmentResult,
            parent: parentResult,
            patient: result[0],
            patient1: result[0].progress[0].month1,
            patient2: result[0].progress[1].month2,
            patient3: result[0].progress[2].month3,
            patient4: result[0].progress[3].month4,
            patient5: result[0].progress[4].month5,
            uId: ObjectId(req.session.passport.user)
          })
        })
      })
    })
  });

// doctors view of the childs page

  app.get('/patient', isLoggedIn, function(req, res) {

    db.collection('patients').findOne({name:req.query.name},(err, childResult) => {
      const patientId = childResult._id
      console.log('this is patient info:', ObjectId(patientId))
      db.collection('appointments').find({

        "_id": patientId
      }).toArray((err, appointmentResult) => {
      if (err) return console.log(err)
      res.render('patient_profile.ejs', {
        appointments: appointmentResult,
        patient: childResult,

        uId: ObjectId(req.session.passport.user)
      })
    })
  })
});

  // Images saving them to the database
  // need help getting the url to match the keyword when updating images
  // var upload = multer({ dest: "./public/images/uploads/"});

  var storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/images/uploads')
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname)
    }
  });

  var upload = multer({storage: storage});

  app.post('/uploadImage', upload.single('patientPhotos'), (req, res, next) => {
    console.log(res)
    insertDocuments(db, req, 'images/uploads/' + req.file.originalname, () => {
      res.redirect(req.get('referer'));
      // res.redirect('/patient?name=<%=patientList[i].name')
    });
  });

  var insertDocuments = function(db, req, filePath, callback) {
    // console.log("saving image as:", filePath);
    var collection = db.collection('patients');
    // console.log('what im looking for:' , req.body.name)
    // console.log('Here:',filePath)
    collection.findOneAndUpdate({name: req.body.name}, {

      $set: {
        image: filePath
      }
    }, {
      sort: {_id: -1},
      upsert: false
    }, (err, result) => {
      if (err) return res.send(err)
      callback(result)
    })
  }

  // updating private notes

  app.post('/updateNotes',(req, res, next) =>{
    console.log('running updateNotes')
    updatePrivateNotesInDatabase(db, req, ()=>{
      res.redirect(req.get('referer'));
    });
  });

  var updatePrivateNotesInDatabase = function (db, req, callback){
    var collection = db.collection('patients');
    var patientId = ObjectId(req.body.patientId)
    console.log('this is the user ID',patientId)
    collection.findOneAndUpdate({"_id": patientId},{

      $push: {
        privateNotes: {date: req.body.date ,time: req.body.time, note: req.body.notes, user: ObjectId(req.session.passport.user)}

      }
    }, {
      sort: {_id: -1},
      upsert: false
    }, (err, result) => {
      console.log('this is the result:',result)
      if (err) return res.send(err)
      callback(result)
    })

  }

  app.post('/addChildToParent',(req, res, next) =>{
    console.log('running addChildToParent')
    updateParentInDatabase(db, req, ()=>{
      res.redirect(req.get('referer'));
    });
  });
  var updateParentInDatabase = function (db, req, callback){
    var collection = db.collection('users');
    var patientId = ObjectId(req.body.patientId)
    console.log('this is the user ID',patientId)
    collection.findOneAndUpdate({"local.email": req.body.email}, {

      $push: {
        children: {childId: patientId}
      }
    }, {
      sort: {_id: -1},
      upsert: false
    }, (err, result) => {
      if (err) return res.send(err)
      callback(result)
    })

  }

  // updating public notes

  app.post('/updateNotes2',(req, res, next) =>{
    console.log('running updateNotes2')
    updateNotesInDatabase(db, req, ()=>{
      res.redirect(req.get('referer'));
    });
  });

  var updateNotesInDatabase = function (db, req, callback){
    var collection = db.collection('patients');
    var patientId = ObjectId(req.body.patientId)
    console.log('this is the user ID',patientId)
    collection.findOneAndUpdate({"_id": patientId}, {

      $push: {
        publicNotes: {date: req.body.date ,time: req.body.time, note: req.body.notes}
      }
    }, {
      sort: {_id: -1},
      upsert: false
    }, (err, result) => {
      if (err) return res.send(err)
      callback(result)
    })

  }

  // adding progress information for MONTH1 to turn into a graph hopefully
  app.post('/month1Progress',(req, res, next) =>{
    console.log('running month2Progress')
    updateProgressInDatabase('month1', db, req, (err)=>{
      if(err){
        return next(err)
      }
      res.redirect(req.get('referer'));
    });
  });

  var updateProgressInDatabase = function (month, db, req, callback){
    var collection = db.collection('patients');
    var patientId = ObjectId(req.body.patientId)
    console.log('this is the user ID',patientId)
    collection.findOne({"_id": patientId},(err, result) =>  {
      if(err){
        return callback(err)
      }
      // this is letting me find things in the object
      // element.month1 === element['month1']
      let monthProgress = result.progress.find(element => element[month] !== undefined)
      if(monthProgress){
        monthProgress[month] = req.body.progress
      }else{
        // below code is if it doesnt find that month property in the database it will then create it
        monthProgress = {}
        monthProgress[month] = req.body.progress
        result.progress.push(monthProgress)
      }
      collection.save( result, (err, res) =>{
        if(err){
          return callback(err)
        }
        callback()
      })
    })
  }
  // adding progressNumber information for MONTH2 to be able to use that data to
  // create a chart

  app.post('/month2Progress',(req, res, next) =>{
    console.log('running month2Progress')
    updateProgressInDatabase('month2',db, req, (err)=>{
      if(err){
        return next(err)
      }
      res.redirect(req.get('referer'));
    });
  });

  // adding progressNumber for MONTH3
  app.post('/month3Progress',(req, res, next) =>{
    console.log('running month2Progress')
    updateProgressInDatabase('month3',db, req, (err)=>{
      if(err){
        return next(err)
      }
      res.redirect(req.get('referer'));
    });
  });


  // adding progressNumber for MONTH4
  app.post('/month4Progress',(req, res, next) =>{
    console.log('running month2Progress')
    updateProgressInDatabase('month4',db, req, (err)=>{
      if(err){
        return next(err)
      }
      res.redirect(req.get('referer'));
    });
  });


  // adding progress information for MONTH5
  app.post('/month5Progress',(req, res, next) =>{
    console.log('running month2Progress')
    updateProgressInDatabase('month5',db, req, (err)=>{
      if(err){
        return next(err)
      }
      res.redirect(req.get('referer'));
    });
  });



















  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, function(req, res) {
    db.collection('messages').find().toArray((err, result) => {
      if (err) return console.log(err)
      res.render('profile.ejs', {
        user : req.user
      })
    })
  });

  // LOGOUT ==============================
  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  //

  // board routes ===============================================================



  app.put('/editNotes', (req, res) => {
    db.collection('patients')
    .findOneAndUpdate({date: req.body.date, time: req.body.time}, {
      $set: {
        note:req.body.note
      }
    }, {
      sort: {_id: -1},
      upsert: true
    }, (err, result) => {
      if (err) return res.send(err)
      res.send(result)
    })
  })



  app.delete('/messages', (req, res) => {
    db.collection('messages').findOneAndDelete({name: req.body.name,
      msg: req.body.msg}, (err, result) => {
        if (err) return res.send(500, err)
        res.send('Message deleted!')
      })
    })

    // =============================================================================
    // AUTHENTICATE (FIRST LOGIN) ==================================================
    // =============================================================================

    // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function(req, res) {
      console.log('is running *************************************')
      const loginMessage = req.flash('loginMessage');
      res.render('login.ejs', { message: loginMessage });
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
      successRedirect : '/dashboard', // redirect to the secure profile section
      failureRedirect : '/login', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

    // process the parentlogin form
    app.post('/parentLogin', passport.authenticate('local-login', {
      successRedirect : '/parentView', // redirect to the secure profile section
      failureRedirect : '/parentLogin', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form
    app.get('/signup', function(req, res) {

      res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
      successRedirect : '/patientSearch', // redirect to the secure profile section
      failureRedirect : '/signup', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

    app.post('/parentSignup', passport.authenticate('local-signup', {
      successRedirect : '/thankYou', // redirect to the secure profile section
      failureRedirect : '/parentSignup', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
    }));

    // =============================================================================
    // UNLINK ACCOUNTS =============================================================
    // =============================================================================
    // used to unlink accounts. for social accounts, just remove the token
    // for local account, remove email and password
    // user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
      var user            = req.user;
      user.local.email    = undefined;
      user.local.password = undefined;
      user.save(function(err) {
        res.redirect('/profile');
      });
    });

  };

  // route middleware to ensure user is logged in
  function isLoggedIn(req, res, next) {
      console.log('login is running')
    if (req.isAuthenticated())
    return next();

    res.redirect('/');
  }
