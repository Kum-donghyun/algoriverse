const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 사용자 회원가입
exports.createUser = async (req, res) => {
  try {
    const { USER_ID, PW, NICK, BIRTH, GENDER, RECOMMEND, EMAIL } = req.body;

    // 아이디 중복확인
    const existingUser = await User.findByPk(USER_ID);
    if (existingUser) {
      return res.status(409).json({ message: '이미 존재하는 사용자 ID입니다.' });
    }

    // RECOMMEND 기본값 처리 (빈 문자열이거나 없으면 0 또는 null)
    const recommendValue = (RECOMMEND === '' || RECOMMEND === null || RECOMMEND === undefined) ? null : RECOMMEND;

    // 사용자 생성
    const newUser = await User.create({
      USER_ID,
      PW: PW, // 평문 비밀번호를 전달하면 모델의 beforeCreate 훅에서 해싱됩니다.
      NICK,
      BIRTH,
      GENDER,
      RECOMMEND: recommendValue,
      EMAIL,
    });

    res.status(201).json({ message: '회원가입 완료', user: newUser });
  } catch (err) {
    console.error('User creation error:', err);
    res.status(500).json({ error: '회원가입 실패' });
  }
};

// 사용자 로그인 (JWT 토큰 발급)
exports.loginUser = async (req, res) => {
  const { USER_ID, PW } = req.body;

  console.log('Login attempt for USER_ID:', USER_ID);
  console.log('Received password (plain text):', PW);

  try {
    // 1. 사용자 존재 여부 확인
    const user = await User.findByPk(USER_ID);
    if (!user) {
      console.log('User not found for USER_ID:', USER_ID);
      return res.status(404).json({ message: '존재하지 않는 사용자 ID입니다.' });
    }

    console.log('User found in DB:', user.USER_ID);
    console.log('Stored hashed password:', user.PW);

    // 2. 비밀번호 비교
    const isMatch = await bcrypt.compare(PW, user.PW);
    console.log('Password comparison result (isMatch):', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    // 3. JWT 토큰 발급
    const payload = { USER_ID: user.USER_ID };
    if (user.ADMIN_ID) {
      payload.ADMIN_ID = user.ADMIN_ID;
    }

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const message = user.ADMIN_ID ? '관리자 로그인 성공' : '로그인 성공';

    res.status(200).json({
      message,
      token,
      user: { USER_ID: user.USER_ID, NICK: user.NICK }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류로 로그인 실패' });
  }
};

// 사용자 로그아웃
exports.logoutUser = async (req, res) => {
  try {
    // 클라이언트 측에서 토큰을 삭제하므로 서버에서는 별도 작업 불필요
    res.status(200).json({ message: '로그아웃 성공' });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    res.status(500).json({ message: '로그아웃 실패' });
  }
};

// 사용자 회원 탈퇴
exports.deleteUser = async (req, res) => {
    // JWT 미들웨어에서 req.user가 설정되었는지 확인
    if (!req.user || !req.user.USER_ID) {
        return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 다시 로그인 해주세요.' });
    }

    const userIdToDelete = req.user.USER_ID; // 인증된 사용자의 ID

    try {
        const deletedRows = await User.destroy({
            where: { USER_ID: userIdToDelete }
        });

        if (deletedRows > 0) {
            res.status(200).json({ message: `${userIdToDelete} 사용자 계정 삭제 완료` });
        } else {
            // 이 경우는 사용자가 존재하지 않거나 이미 삭제된 경우입니다.
            res.status(404).json({ message: '해당 ID의 사용자를 찾을 수 없거나 이미 삭제되었습니다.' });
        }
        
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        res.status(500).json({ message: '사용자 삭제 실패' });
    }
};

// 내 정보 보기
exports.getMe = async (req, res) => {
    if (!req.user || !req.user.USER_ID) {
        return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 다시 로그인 해주세요.' });
    }

    try {
        const user = await User.findByPk(req.user.USER_ID, {
            attributes: { exclude: ['PW'] }
        });

        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('내 정보 조회 오류:', error);
        res.status(500).json({ message: '서버 오류로 내 정보 조회에 실패했습니다.' });
    }
};

// 비밀번호 확인
exports.checkPassword = async (req, res) => {
    if (!req.user || !req.user.USER_ID) {
        return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 다시 로그인 해주세요.' });
    }

    const { PW } = req.body;
    if (!PW) {
        return res.status(400).json({ message: '비밀번호를 입력해주세요.' });
    }

    try {
        const user = await User.findByPk(req.user.USER_ID);
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const isMatch = await bcrypt.compare(PW, user.PW);
        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        res.status(200).json({ message: '비밀번호가 확인되었습니다.' });
    } catch (error) {
        console.error('비밀번호 확인 오류:', error);
        res.status(500).json({ message: '서버 오류로 비밀번호 확인에 실패했습니다.' });
    }
};

// 아이디 찾기
exports.findId = async (req, res) => {
    const { NICK, EMAIL } = req.body;

    try {
        const user = await User.findOne({ where: { NICK, EMAIL } });

        if (user) {
            res.status(200).json({ USER_ID: user.USER_ID });
        } else {
            res.status(404).json({ message: '이름 또는 이메일이 일치하지 않거나 가입되지 않은 사용자입니다.' });
        }
    } catch (error) {
        console.error('아이디 찾기 오류:', error);
        res.status(500).json({ message: '서버 오류로 아이디를 찾는 데 실패했습니다.' });
    }
};

// 비밀번호 찾기
exports.findPw = async (req, res) => {
    const { USER_ID, EMAIL } = req.body;

    // Debugging logs
    console.log('findPw request body:', req.body);

    try {
        const user = await User.findOne({ where: { USER_ID, EMAIL } });

        if (user) {
            console.log('User found for findPw:', user.toJSON()); // Log user data
            // 임시 비밀번호 설정
            const tempPassword = '123456789';
            
            // 임시 비밀번호를 모델에 직접 설정합니다.
            // user.js의 beforeUpdate hook이 해싱을 처리하므로, 여기서는 평문 비밀번호를 전달해야 합니다.
            user.PW = tempPassword;
            await user.save();
            
            console.log('Temporary password set and user saved. Temp PW:', tempPassword); // Log temp password

            res.status(200).json({ message: '임시 비밀번호가 설정되었습니다.', user: { USER_ID: user.USER_ID, NICK: user.NICK }, tempPassword: tempPassword });
        } else {
            res.status(404).json({ message: '아이디, 이메일이 일치하지 않거나 가입되지 않은 사용자입니다.' });
        }
    } catch (error) {
        console.error('비밀번호 찾기 오류:', error);
        res.status(500).json({ message: '서버 오류로 비밀번호를 찾는 데 실패했습니다.' });
    }
};

// 사용자 정보 수정
exports.updateUser = async (req, res) => {
    // JWT 미들웨어에서 req.user가 설정되었는지 확인
    if (!req.user || !req.user.USER_ID) {
        return res.status(401).json({ message: '인증 정보가 유효하지 않습니다. 다시 로그인 해주세요.' });
    }

    const userIdToUpdate = req.user.USER_ID; // JWT 토큰에서 얻은 사용자 ID
    const { PW, NICK, BIRTH, GENDER, RECOMMEND, EMAIL } = req.body; // 클라이언트에서 전송된 업데이트 데이터

    try {
        const user = await User.findByPk(userIdToUpdate);

        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        // 업데이트할 필드를 객체로 구성
        const updateFields = {};
        if (PW) updateFields.PW = PW; // 비밀번호는 모델의 beforeUpdate 훅에서 해싱됨
        if (NICK) updateFields.NICK = NICK;
        if (BIRTH) updateFields.BIRTH = BIRTH;
        if (GENDER) updateFields.GENDER = GENDER;
        // RECOMMEND는 TINYINT 타입이므로 숫자 또는 null을 기대
        if (RECOMMEND !== undefined) { // 클라이언트가 명시적으로 RECOMMEND를 보냈을 경우
             // 빈 문자열이 오면 null로 처리, 아니면 숫자 값 사용
            updateFields.RECOMMEND = RECOMMEND === '' ? null : RECOMMEND;
        }
        if (EMAIL) updateFields.EMAIL = EMAIL;

        // User 모델의 update 메서드 사용
        await user.update(updateFields);

        res.status(200).json({ message: '사용자 정보가 성공적으로 수정되었습니다.' });

    } catch (error) {
        console.error('사용자 정보 수정 오류:', error);
        res.status(500).json({ message: '서버 오류로 사용자 정보 수정에 실패했습니다.' });
    }
};