package com.techelevator.tenmo.services;

import java.math.BigDecimal;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import com.techelevator.tenmo.models.AuthenticatedUser;
import com.techelevator.tenmo.models.ForeignUser;

@RestController
public class UserService {

	private String BASE_URL;
	private RestTemplate restTemplate = new RestTemplate();
	private AuthenticatedUser currentUser;
	private Integer userId;

	public void setCurrentUser(AuthenticatedUser currentUser) {
		this.currentUser = currentUser;
		this.userId = currentUser.getUser().getId();
	}

	public UserService(String url) {
		this.BASE_URL = url;
	}

	private HttpEntity getAuthorizedEntity() {
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		return new HttpEntity<>(headers);
	}

	public BigDecimal getBalance() throws UserServiceException {
		HttpEntity entity = getAuthorizedEntity();
		BigDecimal balance = null;
		try {
			balance = restTemplate
					.exchange(BASE_URL + "accounts/" + userId + "/balance", HttpMethod.GET, entity, BigDecimal.class)
					.getBody();
		} catch (RestClientResponseException ex) {

		}
		return balance;
	}

	public Map<Integer, String> getUsers() throws UserServiceException {
		HttpEntity entity = getAuthorizedEntity();
		ForeignUser[] userArray = null;
		Map<Integer, String> userMap = new TreeMap<>();
		try {
			userArray = restTemplate.exchange(BASE_URL + "/users", HttpMethod.GET, entity, ForeignUser[].class)
					.getBody();
		} catch (RestClientResponseException ex) {

		}
		for(ForeignUser user : userArray) {
			userMap.put(user.getUser_id(), user.getUsername());
		}
		userMap.remove(currentUser.getUser().getId());
		return userMap;
	}
}
