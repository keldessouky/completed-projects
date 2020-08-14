package com.techelevator.model.domain;

public class Venue {
	private long id;
	private String name;
	private int cityId;
	private String description;
	private String cityName;
	private String stateAbbreviation;
	private String categoryName;

	public Venue() {

	}

	public String getCategoryName() {
		return categoryName;
	}

	public void setCategoryName(String categoryName) {
		this.categoryName = categoryName;
	}

	public long getId() {
		return id;
	}

	public String getCityName() {
		return cityName;
	}

	public void setCityName(String cityName) {
		this.cityName = cityName;
	}

	public String getStateAbbreviation() {
		return stateAbbreviation;
	}

	public void setStateAbbreviation(String stateAbbreviation) {
		this.stateAbbreviation = stateAbbreviation;
	}

	public String getName() {
		return name;
	}

	public int getCityId() {
		return cityId;
	}

	public String getDescription() {
		return description;
	}

	public void setId(long id) {
		this.id = id;
	}

	public void setName(String name) {
		this.name = name;
	}

	public void setCityId(int cityId) {
		this.cityId = cityId;
	}

	public void setDescription(String description) {
		this.description = description;
	}

}
