package com.techelevator.tenmo.dao;

import com.techelevator.tenmo.model.ForeignUserDTO;
import com.techelevator.tenmo.model.User;

import java.util.List;
import java.util.Map;

public interface UserDAO {

    List<User> findAll();

    User findByUsername(String username);

    int findIdByUsername(String username);

    Map<String, Integer> findAllUserIdAndName();
    
    ForeignUserDTO[] findForeignUsers();
    
    boolean create(String username, String password);
}
